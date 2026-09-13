import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MeshSession } from './src/mesh';
import { result, other, Mark } from './src/domain';
import {
  Arrive,
  Board,
  Button,
  Celebration,
  colors as C,
  font,
  haptic,
  MarkArt,
  Radar,
} from './src/ui/Playful';

function Game() {
  const [mesh, setMesh] = useState<MeshSession>(),
    [, render] = useState(0),
    [busy, setBusy] = useState(false);
  const current = useRef<MeshSession | undefined>(undefined),
    alive = useRef(true),
    changing = useRef(false);
  const [showRules, setShowRules] = useState(false);
  const lastRole = useRef(true);
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') current.current?.session.tick();
    });
    return () => {
      alive.current = false;
      sub.remove();
      void current.current?.close().catch(() => {});
    };
  }, []);
  const start = (host: boolean) => {
    if (current.current || changing.current) return;
    lastRole.current = host;
    const m = new MeshSession(host, () => {
      if (alive.current) render((n) => n + 1);
    });
    current.current = m;
    setMesh(m);
    void m.start();
  };
  const leave = async (again = false) => {
    if (changing.current) return;
    changing.current = true;
    setBusy(true);
    try {
      await current.current?.close();
    } catch {
      /* stop has already been attempted */
    } finally {
      current.current = undefined;
      changing.current = false;
      if (alive.current) {
        setMesh(undefined);
        setBusy(false);
        if (again) start(lastRole.current);
      }
    }
  };
  const isHost = mesh?.session.host ?? false;
  const v = mesh?.session.view,
    game = v?.domain,
    end = game ? result(game.board) : undefined;
  const me: Mark = mesh?.session.host ? 'X' : 'O';
  const them: Mark = other(me);
  const finished = !!(end?.winner || end?.draw),
    myTurn = game?.turn === me;
  const prior = useRef('');
  useEffect(() => {
    const key = `${v?.phase}-${game?.round}-${game?.board.join('')}`;
    if (prior.current && prior.current !== key && v?.phase === 'active')
      haptic();
    prior.current = key;
  }, [v?.phase, game?.round, game?.board]);
  const header = (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        onPress={() => (mesh ? void leave() : setShowRules(false))}
        hitSlop={12}
      >
        <Text style={s.wordmark}>✳ little rivalry</Text>
      </Pressable>
      <View style={s.pill}>
        <View style={s.greenDot} />
        <Text style={s.pillText}>
          {v?.phase === 'active'
            ? 'CONNECTED'
            : isHost
              ? 'HOST'
              : 'JOIN'}
        </Text>
      </View>
    </View>
  );
  let content: React.ReactNode;
  if (!mesh)
    content = (
      <Arrive style={s.home}>
        <View style={s.eyebrowWrap}>
          <Text style={s.eyebrow}>TWO PHONES. ONE LITTLE RIVALRY.</Text>
        </View>
        <Text accessibilityRole="header" style={s.hero}>
          Tic. Tac.<Text style={{ color: C.coral }}>{'\n'}Together.</Text>
        </Text>
        <Text style={s.subtitle}>
          A classic game. A nearby friend.{'\n'}A very good reason for one more
          round.
        </Text>
        <View style={s.heroArt}>
          <View style={s.yellowStar}>
            <Text style={s.star}>✦</Text>
          </View>
          <Board
            board={['X', null, 'O', null, 'X', null, 'O', null, 'X']}
            line={[]}
            enabled={false}
            move={() => {}}
            decorative
          />
          <View style={s.artBadge}>
            <Text style={s.artBadgeText}>better together ↗</Text>
          </View>
        </View>
        <View style={s.homeBottom}>
          <Button onPress={() => start(true)} disabled={busy}>
            Host game ↗
          </Button>
          <Button secondary onPress={() => start(false)} disabled={busy}>
            Join game
          </Button>
          <Text style={s.smallCentered}>
            Host on one phone, Join on the other. No internet or sign-up.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowRules(!showRules)}
            style={s.rulesButton}
          >
            <Text style={s.rulesLink}>
              {showRules ? 'Got it!' : 'How to play  ⓘ'}
            </Text>
          </Pressable>
          {showRules && (
            <Text style={s.rules}>
              One phone taps Host game, the other Join game. The guest taps
              Connect; the host taps Accept. Take turns — three in a row wins!
            </Text>
          )}
        </View>
      </Arrive>
    );
  else if (mesh.error)
    content = (
      <Arrive style={s.center}>
        <Text style={s.bigEmoji}>📡</Text>
        <Text style={s.title}>A little connection help</Text>
        <Text style={s.subtitle}>{mesh.error}</Text>
        <Button onPress={() => void Linking.openSettings()}>
          Open Settings
        </Button>
        <Button secondary onPress={() => void leave(true)} disabled={busy}>
          Try again
        </Button>
      </Arrive>
    );
  else if (v?.phase === 'disconnected')
    content = (
      <Arrive style={s.center}>
        <Text style={s.bigEmoji}>🛸</Text>
        <Text style={s.title}>Opponent disconnected</Text>
        <Text style={s.subtitle}>{v.notice}</Text>
        <Text style={s.smallCentered}>
          {v.recoverable
            ? 'Your board and score are safe. Move closer and keep both apps open.'
            : 'Find a nearby friend for a fresh little rivalry.'}
        </Text>
        {v.recoverable && (
          <Button onPress={() => mesh.session.waitForOpponent()}>
            Wait for them
          </Button>
        )}
        <Button secondary onPress={() => void leave(true)} disabled={busy}>
          Find another player
        </Button>
      </Arrive>
    );
  else if (v?.phase === 'active' && game && end) {
    const kind = end.draw ? 'draw' : end.winner === me ? 'win' : 'loss';
    content = (
      <Arrive style={s.play}>
        <View style={s.roundRow}>
          <Text style={s.eyebrow}>THE FRIENDLY FACE-OFF</Text>
          <Text style={s.round}>
            Round {game.round.toString().padStart(2, '0')}
          </Text>
        </View>
        <View style={s.players}>
          {[me, them].map((mark, i) => (
            <View
              key={mark}
              style={[
                s.player,
                game.turn === mark && !finished && s.activePlayer,
              ]}
            >
              <View
                style={[
                  s.avatar,
                  { backgroundColor: mark === 'X' ? '#FCE3DB' : C.lavender },
                ]}
              >
                <MarkArt mark={mark} size={45} animate={false} />
              </View>
              <Text style={s.playerName}>
                {i === 0
                  ? 'You'
                  : `Player ${mesh.session.opponentPeer().slice(-4).toUpperCase()}`}
              </Text>
              <Text style={s.score}>
                {game.scores[mark]} <Text style={s.wins}>wins</Text>
              </Text>
              {game.turn === mark && !finished && <View style={s.turnDot} />}
            </View>
          ))}
          <Text style={s.vs}>vs</Text>
        </View>
        <View accessibilityLiveRegion="polite" style={s.turnBanner}>
          <Text style={s.turnText}>
            {finished
              ? 'A little rivalry. A lot of fun.'
              : v.syncing
                ? 'Sending a little magic…'
                : myTurn
                  ? 'Your turn. Make your mark!'
                  : 'Their turn. Plot your next move.'}
          </Text>
          {!finished && <Text style={s.turnSymbol}>{myTurn ? '✦' : '◌'}</Text>}
        </View>
        <Board
          board={game.board}
          line={end.line}
          enabled={myTurn && !finished && !v.syncing}
          move={(cell) => mesh.session.action({ kind: 'move', cell })}
        />
        {finished ? (
          <Arrive
            key={`${game.round}-${kind}`}
            style={[
              s.result,
              kind === 'loss' && { backgroundColor: '#EDEAF7' },
              kind === 'draw' && { backgroundColor: '#E5EFE4' },
            ]}
          >
            <Celebration kind={kind} />
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={s.resultTitle}
            >
              {kind === 'win'
                ? 'You won! 🎉'
                : kind === 'loss'
                  ? 'So close!'
                  : 'It’s a draw 🤝'}
            </Text>
            <Text style={s.resultSubtitle}>
              {kind === 'win'
                ? 'Three in a row. Look at you go.'
                : kind === 'loss'
                  ? 'A tiny rain cloud. A fresh chance next round.'
                  : 'Great minds block alike.'}
            </Text>
            {game.rematch === them ? (
              <View style={s.rematch}>
                <Text style={s.rematchText}>Your opponent wants a rematch</Text>
                <View style={s.actions}>
                  <View style={s.flex}>
                    <Button
                      disabled={v.syncing}
                      onPress={() => mesh.session.action({ kind: 'accept' })}
                    >
                      Accept
                    </Button>
                  </View>
                  <View style={s.flex}>
                    <Button
                      secondary
                      disabled={v.syncing}
                      onPress={() => mesh.session.action({ kind: 'decline' })}
                    >
                      Decline
                    </Button>
                  </View>
                </View>
              </View>
            ) : (
              <>
                <Button
                  disabled={v.syncing || game.rematch === me}
                  onPress={() => mesh.session.action({ kind: 'rematch' })}
                >
                  {game.rematch === me
                    ? 'Rematch requested…'
                    : 'One more round?  ↻'}
                </Button>
                {game.declined && (
                  <Text style={s.smallCentered}>
                    Rematch declined. Thanks for playing together!
                  </Text>
                )}
              </>
            )}
          </Arrive>
        ) : (
          <View style={s.roundFooter}>
            <Text style={s.smallCentered}>THREE IN A ROW. ALL THE GLORY.</Text>
            <Text style={s.smallCentered}>
              {game.scores.draws} {game.scores.draws === 1 ? 'draw' : 'draws'} ·
              X and O alternate first move each round
            </Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => void leave(true)}
          disabled={busy}
          style={s.rulesButton}
        >
          <Text style={s.rulesLink}>Leave & find someone new ↗</Text>
        </Pressable>
      </Arrive>
    );
  } else
    content = (
      <Arrive style={s.scan}>
        <Text style={s.eyebrow}>
          {isHost ? 'YOU’RE HOSTING' : 'GOOD COMPANY IS CLOSE'}
        </Text>
        <Text accessibilityRole="header" style={s.title}>
          {isHost && v?.phase === 'waiting'
            ? 'Waiting for\nyour rival.'
            : v?.phase === 'connecting'
              ? 'Making a connection…'
              : 'Find your\nfriendly rival.'}
        </Text>
        <Text style={s.subtitle}>
          {isHost && v?.phase === 'waiting'
            ? 'Share your host code with the other phone.\nThey join, then tap Accept here.'
            : v?.phase === 'connecting'
              ? 'Your invitation is on its way.\nThey just need to tap Accept.'
              : 'Pick a listed host and tap Connect.'}
        </Text>
        {isHost && v?.phase === 'waiting' && mesh.ready && (
          <View style={s.hostCodeBox}>
            <Text style={s.hostCodeLabel}>Host code</Text>
            <Text accessibilityRole="header" style={s.hostCode}>
              {mesh.localSessionCode()}
            </Text>
            <Text style={s.smallCentered}>
              Last 6 characters — should match a game on Join
            </Text>
          </View>
        )}
        <Radar connecting={v?.phase === 'connecting'} />
        <Text accessibilityLiveRegion="polite" style={s.scanningLabel}>
          {!mesh.ready
            ? 'Waking up Bluetooth…'
            : v?.phase === 'connecting'
              ? 'Connecting you two…'
              : isHost
                ? mesh.incomingRequests.length
                  ? 'Someone wants to play!'
                  : 'Waiting for a join request…'
                : mesh.nearby.length
                  ? 'Look who’s nearby!'
                  : mesh.nearbyPeerCount > 0
                    ? 'Phone nearby — listing host…'
                    : 'Looking for nearby hosts…'}
        </Text>
        {!isHost &&
          v?.phase !== 'connecting' &&
          mesh.nearbyPeerCount > 0 &&
          mesh.nearby.length === 0 && (
            <Text style={s.smallCentered}>
              Wait a few seconds after “Verified player”, or until a host
              listing appears (code should match the host phone).
            </Text>
          )}
        {isHost &&
          mesh.incomingRequests.map((r) => (
          <Arrive key={r.peer} style={s.invitation}>
            <Text style={s.playerName}>{r.name} wants to play ✦</Text>
            <Text style={s.peerHint}>
              Your next little rivalry starts here.
            </Text>
            <View style={s.actions}>
              <View style={s.flex}>
                <Button onPress={() => void mesh.acceptRequest(r.peer)}>
                  Accept
                </Button>
              </View>
              <View style={s.flex}>
                <Button
                  secondary
                  onPress={() => void mesh.rejectRequest(r.peer)}
                >
                  Decline
                </Button>
              </View>
            </View>
          </Arrive>
          ))}
        {!isHost &&
          v?.phase !== 'connecting' &&
          mesh.nearby.map((p) => (
            <Arrive key={p.peer} style={s.peer}>
              <View style={s.peerAvatar}>
                <Text style={s.peerFace}>☺</Text>
              </View>
              <View style={s.flex}>
                <Text style={s.playerName}>{p.name}</Text>
                <Text style={s.peerHint}>
                  {p.reachable
                    ? 'Nearby · ready for a rivalry'
                    : 'Just out of range'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Connect to ${p.name}`}
                disabled={!p.reachable || !mesh.peerReadyForJoin(p.peer)}
                onPress={() => {
                  haptic();
                  void mesh.requestJoin(p.peer);
                }}
                style={[
                  s.connect,
                  (!p.reachable || !mesh.peerReadyForJoin(p.peer)) && {
                    opacity: 0.4,
                  },
                ]}
              >
                <Text style={s.connectText}>
                  {mesh.peerReadyForJoin(p.peer) ? 'Connect' : 'One sec'}
                </Text>
              </Pressable>
            </Arrive>
          ))}
        {!!mesh.discoveryError && (
          <Text style={s.smallCentered}>{mesh.discoveryError}</Text>
        )}
        <View style={s.scanTip}>
          <Text style={s.tipIcon}>✳</Text>
          <Text style={s.tipText}>
            {isHost
              ? 'Other phone: tap Join game, then Connect to you.'
              : 'Other phone: tap Host game and share their code with you.'}
          </Text>
        </View>
        <Button secondary onPress={() => void leave()} disabled={busy}>
          Cancel
        </Button>
      </Arrive>
    );
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
      <ScrollView
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
      >
        {header}
        {content}
        <View style={s.brandFooter}>
          <Text style={s.footer}>✳ powered by Offline Protocol</Text>
          <Text style={s.footerDot}>•••</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Game />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  page: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 12,
    paddingBottom: 14,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  wordmark: {
    fontFamily: font,
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.5,
  },
  pill: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: '#EEECE4',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 20,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#78A389',
  },
  pillText: {
    fontFamily: font,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#5D6860',
  },
  home: { flex: 1 },
  eyebrowWrap: { marginTop: 8 },
  eyebrow: {
    fontFamily: font,
    color: C.muted,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.8,
  },
  hero: {
    fontFamily: font,
    fontSize: 59,
    lineHeight: 63,
    letterSpacing: -3,
    fontWeight: '800',
    color: C.ink,
    marginTop: 15,
  },
  subtitle: {
    fontFamily: font,
    fontSize: 15,
    lineHeight: 24,
    color: '#7A7685',
    marginTop: 15,
  },
  heroArt: {
    width: '77%',
    alignSelf: 'center',
    marginTop: 37,
    marginBottom: 37,
  },
  yellowStar: { position: 'absolute', right: -40, top: -28, zIndex: 2 },
  star: { fontSize: 62, color: '#DBB650' },
  artBadge: {
    position: 'absolute',
    right: -26,
    bottom: -12,
    backgroundColor: C.mint,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 9,
    transform: [{ rotate: '5deg' }],
  },
  artBadgeText: {
    fontFamily: font,
    fontSize: 11,
    fontWeight: '700',
    color: '#42664F',
  },
  homeBottom: { gap: 12 },
  smallCentered: {
    fontFamily: font,
    fontSize: 11,
    lineHeight: 18,
    color: C.muted,
    textAlign: 'center',
  },
  rulesButton: { padding: 13, alignItems: 'center' },
  rulesLink: {
    fontFamily: font,
    fontWeight: '600',
    fontSize: 12,
    color: '#777183',
  },
  rules: {
    fontFamily: font,
    fontSize: 13,
    lineHeight: 22,
    color: C.muted,
    paddingHorizontal: 8,
  },
  brandFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 24,
    marginTop: 'auto',
  },
  footer: { fontFamily: font, fontSize: 9, color: '#A49FAB' },
  footerDot: { color: '#C4BDCE', letterSpacing: 3 },
  center: { flex: 1, justifyContent: 'center', gap: 20, paddingVertical: 45 },
  bigEmoji: { fontSize: 72, textAlign: 'center' },
  title: {
    fontFamily: font,
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.6,
    color: C.ink,
    marginTop: 14,
  },
  scan: { gap: 12 },
  hostCodeBox: {
    alignItems: 'center',
    backgroundColor: '#F0EBE2',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 4,
  },
  hostCodeLabel: {
    fontFamily: font,
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1,
  },
  hostCode: {
    fontFamily: font,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
    color: C.ink,
  },
  scanningLabel: {
    fontFamily: font,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    color: C.ink,
    marginBottom: 12,
  },
  scanTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0EBE2',
    borderRadius: 18,
    padding: 16,
    marginVertical: 8,
  },
  tipIcon: { fontSize: 25, color: C.purple },
  tipText: {
    flex: 1,
    fontFamily: font,
    fontSize: 12,
    lineHeight: 19,
    color: '#7A7486',
  },
  peer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EBE6DD',
  },
  peerAvatar: {
    backgroundColor: C.lavender,
    borderRadius: 15,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerFace: { fontSize: 30, color: C.purple },
  peerHint: {
    fontFamily: font,
    fontSize: 10,
    color: C.muted,
    marginTop: 3,
    marginBottom: 5,
  },
  connect: { borderRadius: 13, backgroundColor: C.ink, padding: 11 },
  connectText: {
    fontFamily: font,
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
  invitation: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: C.lavender,
    gap: 8,
  },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  play: { gap: 18 },
  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  round: { fontFamily: font, fontSize: 11, fontWeight: '700', color: C.muted },
  players: { flexDirection: 'row', gap: 16, position: 'relative' },
  player: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    backgroundColor: '#F1EEE8',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  activePlayer: { borderColor: '#C6B9E9', backgroundColor: '#F2EDF9' },
  avatar: {
    height: 53,
    width: 53,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
  },
  playerName: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  score: {
    fontFamily: font,
    fontSize: 19,
    fontWeight: '800',
    color: C.ink,
    marginTop: 5,
  },
  wins: { fontWeight: '500', fontSize: 11, color: C.muted },
  vs: {
    position: 'absolute',
    top: 62,
    left: '50%',
    marginLeft: -13,
    width: 26,
    textAlign: 'center',
    color: C.muted,
    fontFamily: font,
    fontSize: 11,
    backgroundColor: C.paper,
    borderRadius: 13,
    paddingVertical: 5,
  },
  turnDot: {
    position: 'absolute',
    top: 13,
    right: 13,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.purple,
  },
  turnBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  turnText: { fontFamily: font, fontSize: 13, fontWeight: '600', color: C.ink },
  turnSymbol: { color: C.purple, fontSize: 23 },
  roundFooter: { gap: 9, paddingTop: 10 },
  result: {
    padding: 20,
    borderRadius: 25,
    backgroundColor: '#F7E9D6',
    gap: 12,
  },
  resultTitle: {
    fontFamily: font,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -1,
    color: C.ink,
    textAlign: 'center',
  },
  resultSubtitle: {
    fontFamily: font,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    color: '#827486',
    marginBottom: 5,
  },
  rematch: { gap: 12 },
  rematchText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
  },
});
