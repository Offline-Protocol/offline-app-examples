# Cowrite

An offline Google Docs for the people in the room. Several nearby phones edit one plain-text document together, everyone sees everyone's cursor, and it all runs over Bluetooth with no internet, accounts or server. React Native app for iOS and Android, built on `@offline-protocol/mesh-sdk` 0.27 through the shared `@offline-app-examples/mesh` and `@offline-app-examples/ui` packages.

## Run

From the **monorepo root** (`offline-app-examples/`):

```sh
pnpm install
cd apps/cowrite/ios && pod install && cd ../../..
pnpm --filter @offline-app-examples/cowrite dev
```

In another terminal (still from the monorepo root):

```sh
pnpm --filter @offline-app-examples/cowrite ios -- --device
# or, with an Android phone attached:
pnpm --filter @offline-app-examples/cowrite android
```

You can also `cd apps/cowrite` and use `pnpm start`, `pnpm ios` and `pnpm android` directly.

For iOS, open `ios/Cowrite.xcworkspace`, pick your Apple development team under Signing & Capabilities, and run on each phone. Every phone needs the same app build, Bluetooth on, and Bluetooth (Android: Nearby devices) permission. Android 11 and earlier also need Location permission and Location services on.

Debug builds load JavaScript from Metro. To use the app away from your computer, install a Release build with the bundle embedded (Release scheme in Xcode, or `pnpm android -- --mode release`).

**You need two or more physical phones.** Simulators and emulators run the interface but cannot discover each other over Bluetooth. iOS keeps about four Bluetooth connections per device, so plan for small groups (up to about five people).

## Use

1. Everyone types their name. One phone taps **Start a document** and lands straight in the editor.
2. The others tap **Join a document** and pick that phone from the nearby list. Once the shared group is set up they land in the same document.
3. Type. Edits appear on the other phones within a moment. Each person has a color: their avatar in the bar under the title, and a tinted character where their cursor is in the text.
4. Rename the document by tapping the title.
5. Walk out of range and keep writing: the pill switches to **Offline — edits will sync when nearby**. Come back and both sides merge.
6. **Leave** removes your cursor and returns to the start screen.

## Why a CRDT, not messages

The sibling apps [Stock Sync](../stocksync) and [Order Up](../orderup) sync by broadcasting small app messages ("set item 7 to 12", "order 3 is ready"). That works when each change touches one field and one device is in charge. It breaks down for text that several people type into at the same time:

- **Positions conflict.** "Insert `x` at 42" means something different once someone else inserted three characters at 10. Two phones apply the same pair of edits in different orders and end up with different text.
- **Ordering and loss.** Bluetooth delivers late, twice or not at all. A hand-rolled scheme needs sequence numbers, acknowledgements, retries and a rule for which edit wins, for every kind of edit.
- **Offline merges.** Someone who walks away and keeps typing comes back with a pile of edits made against an old version. Replaying them as messages does not produce what either person meant.
- **Late joiners.** A newcomer needs the whole current document, not the stream of messages they missed, so a host has to build and send snapshots and reconcile them with edits in flight.

Solving all of that by hand is building a CRDT. The SDK already ships one, the replicated document layer (`DataStore`, see the SDK's `docs/data.md`), so Cowrite uses it and only turns keystrokes into edits.

## How Cowrite uses DataStore

**Space = the room's MLS group.** The mesh package runs in group mode (`useNearbyRoom({ group: true })`): the host creates an MLS group and invites everyone who joins. A DataStore *space* is an MLS scope, so the group id is the space id. The group's roster is the document's membership, and replication rides the group's encryption. There is no second list of who may edit.

**The document text is a `text` collection** (`doc` / `body`). Text collections merge character by character: two people typing in the same paragraph both keep their words, and every phone converges on the same text whatever order the edits arrived in, with duplicates and reordering absorbed by the merge. Cowrite never sends "the new text". On every change it compares the previous and new input text (common prefix and suffix, see `src/domain/text.ts`) and applies that one change as `textDelete` + `textInsert` at the right position.

**Cursors are a `map` with last-writer-wins** (`presence` / `cursors`, one key per device, value `{ name, pos, t }` as JSON text). A cursor only matters as "where is it now", so replacing the whole value and keeping the newest write is exactly right, and different people's keys never conflict. Cursor writes are throttled to four a second, repeated every 10 s as a heartbeat, and a cursor that has not changed for 30 s is hidden (on leave the key is deleted). They live in their own document so cursor traffic never touches the text's document. The title is one more map key (`doc` / `meta` / `title`): whoever renamed it last wins.

```ts
import { DataStore } from '@offline-app-examples/mesh';

const store = new DataStore();                 // once the room is running
const space = room.groupId!;                   // the MLS group is the space

// A keystroke: one edit on the shared text (offsets are characters).
await store.textDelete(space, 'doc', 'body', at, removedCount);
await store.textInsert(space, 'doc', 'body', at, 'typed text');
await store.flush(space, 'doc');               // durable, and pushed to the group

// My cursor: last writer wins per key.
await store.mapSet(space, 'presence', 'cursors', room.localId, {
  kind: 'text',
  value: JSON.stringify({ name: 'Ada', pos: 42, t: Date.now() }),
});

// Someone's edit arrived: re-read and re-render.
useNearbyRoom({
  group: true,
  onProtocolEvent: e => e.type === 'data_changed' && e.doc_id === 'doc' && reread(),
  // reread: store.textValue(space, 'doc', 'body'), store.docJson(space, 'presence')
});
```

**When replication happens.**

- *Local change.* Edits batch in memory until `flush()`. A flush makes them durable and immediately pushes the delta to the group. Cowrite flushes 150 ms after the last edit, so a burst of typing goes out as one frame.
- *Anti-entropy.* When a phone joins the group, a member is added, an encrypted session is confirmed, or a peer is rediscovered, the two sides compare document versions and send what the other lacks (at most one sweep per peer every 30 s). An edit received from the group is not re-broadcast, so gaps are closed by these sweeps.
- *Rejoin.* A phone that walked away kept every local edit. When it is back in range the next exchange sends both sides what they missed, however long it was gone, and the merge combines them.

`data_changed` fires after a change is durable, for your own flushes and for merged remote changes. Cowrite re-reads the text there and moves your caret by any remote edit that landed before it (`shiftCaret`), so it stays between the same characters. Everything goes through one serial queue, and a local edit is re-based onto the stored text if a remote change merged in between keystrokes.

**Remote cursors** are drawn inside the text: the TextInput's content is rendered as nested `<Text>` runs, and the character next to each remote cursor gets a tint in that person's color. No characters are inserted, so what you type and where your caret sits are unaffected.

### Limits

- **1 MiB per document** (compacted). A warning event fires at 768 KiB. Plenty for notes and drafts, not for a book.
- **Plain text only.** No bold, headings or images. Map values are replaced whole, so rich formatting would need a different model.
- **Every phone in the group must run a build that speaks group data sync** (SDK 0.27+). One older device stops document sync for the whole group, because group frames reach everyone.
- **A document belongs to its group.** Starting a new document creates a new group. The old document stays on the phone but the app does not reopen it.
- Cursor positions are a hint. They are in the writer's text and shift as edits arrive, so they can be a character off until that person's next cursor write.
- Bluetooth only, small groups (iOS keeps about four connections), and members join through the host.

## Files

| File | What it does |
| --- | --- |
| `App.tsx` | Room in group mode, lobby, counts `data_changed` per document |
| `src/useSharedDoc.ts` | All DataStore calls: text edits, title, presence, flushing, re-reads |
| `src/domain/text.ts` | Pure diff, caret shifting, cursor runs, word count (tested) |
| `src/ui/EditorScreen.tsx` | Editor: title, people, sync pill, the paper, inline cursors |
| `src/ui/illustrations.tsx` | Flat SVG art for the lobby and the empty page |

## Checks

```sh
pnpm --filter @offline-app-examples/cowrite typecheck
pnpm --filter @offline-app-examples/cowrite test
pnpm --filter @offline-app-examples/cowrite lint
```

The tests cover the pure text logic. Syncing needs a physical test on two or more phones: simultaneous typing in one paragraph, typing before someone else's cursor, one phone out of range and editing then coming back, a third phone joining late, and leaving.

SDK license: AGPL-3.0-only, with a commercial dual license available from Offline Protocol. See the installed SDK's license files.
