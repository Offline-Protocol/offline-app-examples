# Tic Tac Together ✳

A small, colorful rivalry between two nearby phones. React Native app for iOS and Android, built on `@offline-app-examples/mesh` (a thin room layer over
`@offline-protocol/mesh-sdk` 0.27, see `packages/mesh/README.md`) and `@offline-app-examples/ui`.

## Run

From the **monorepo root** (`offline-app-examples/`):

```sh
pnpm install
cd apps/tictactogether/ios && pod install && cd ../../..
pnpm --filter @offline-app-examples/tictactogether dev
```

In another terminal (still from the monorepo root):

```sh
pnpm --filter @offline-app-examples/tictactogether ios -- --device
# or, with an Android phone attached:
pnpm --filter @offline-app-examples/tictactogether android
```

You can also `cd apps/tictactogether` and use `pnpm start`, `pnpm ios`, and `pnpm android` directly.

For iOS, open `ios/Tictactogether.xcworkspace`, select your Apple development team under Signing & Capabilities, and run on each phone. Both phones need the same app build, Bluetooth enabled, and Bluetooth/Nearby Devices permission. Android 11 and earlier also need Location permission and Location services enabled.

Debug builds need Metro available to load the app. For fully offline play, install a Release build with the JS bundle embedded (select Release in Xcode’s scheme, or `pnpm android -- --mode release`). Android’s included debug signing configuration is for local testing; use your own signing key for distribution.

BLE discovery requires **two physical phones**. A simulator can display the interface but cannot verify nearby Bluetooth play.

## Play

1. On one phone, enter a name and tap **Host game**. On the other, tap **Join game** and tap the host when it appears.
2. The host plays X, the phone that joined plays O. X starts the first round; the starting mark alternates each rematch.
3. Wins and draws stay in the score while the two phones are connected.
4. Either player may ask for a rematch; the other accepts or declines.
5. If the link drops, the board waits and the game carries on when the phones are back in range. If a different phone joins while the rival is away, it takes the O seat with a fresh board. A third phone joining a full game is told so and sent back to the lobby.

The game screen has drawing marks, turn highlights, a winning line and confetti, a rainy loss graphic, a draw reaction, native haptics, and respects the system Reduce Motion setting.

## How sync works

The host owns the match: `{ rev, game, o }`, where `o` is the room peer id playing O. When O taps, it shows the move right away and sends `{ type: 'action', rev, action }`, tagged with the revision it saw. The host applies it only if `rev` is current, so duplicates and stale taps are ignored, bumps `rev` and broadcasts `{ type: 'state', ...match }`. O keeps resending its action every few seconds until a newer state arrives; the host rebroadcasts the state on the same interval and whenever a peer joins or comes back into range.

| File | What it does |
| --- | --- |
| `App.tsx` | Room wiring: who sends what, lobby vs. game |
| `src/domain/index.ts` | Rules, match revisions, wire messages and their validation (tested) |
| `src/ui/GameScreen.tsx` | Scores, board, result card, rematch |
| `src/ui/Playful.tsx` | Board, animated marks, celebration, haptics |

## Checks

```sh
pnpm typecheck
pnpm test
pnpm format:check
```

The tests cover the rules and message validation. They do not substitute for a two-phone BLE test: iOS↔iOS and iOS↔Android, win/loss/draw, rematch in either direction, leaving, Bluetooth off, permission denial, backgrounding, and walking out of and back into range.

SDK license: AGPL-3.0-only, with a commercial dual license available from Offline Protocol. See the installed SDK’s license files.
