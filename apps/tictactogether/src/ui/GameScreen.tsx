import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, DomainState, Mark, other, result } from '../domain';
import {
  Arrive,
  Board,
  Button,
  Celebration,
  colors as C,
  font,
  haptic,
  MarkArt,
} from './Playful';

type Props = {
  game: DomainState;
  me: Mark;
  rivalName: string;
  /** Member: an action is on its way to the host. */
  syncing: boolean;
  /** The other phone is out of range; the board waits for it. */
  away: boolean;
  onAction: (a: Action) => void;
  onLeave: () => void;
};

export function GameScreen({
  game,
  me,
  rivalName,
  syncing,
  away,
  onAction,
  onLeave,
}: Props) {
  const them = other(me);
  const end = result(game.board);
  const finished = !!(end.winner || end.draw),
    myTurn = game.turn === me,
    blocked = syncing || away;

  const prior = useRef('');
  useEffect(() => {
    const key = `${game.round}-${game.board.join('')}`;
    if (prior.current && prior.current !== key) haptic();
    prior.current = key;
  }, [game.round, game.board]);

  const kind = end.draw ? 'draw' : end.winner === me ? 'win' : 'loss';
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.wordmark}>✳ little rivalry</Text>
          <View style={s.pill}>
            <View style={[s.dot, away && { backgroundColor: C.coral }]} />
            <Text style={s.pillText}>
              {away ? 'RECONNECTING' : 'CONNECTED'}
            </Text>
          </View>
        </View>
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
                <Text style={s.playerName} numberOfLines={1}>
                  {i === 0 ? 'You' : rivalName}
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
              {away
                ? `Waiting for ${rivalName} to come back in range…`
                : finished
                  ? 'A little rivalry. A lot of fun.'
                  : syncing
                    ? 'Sending a little magic…'
                    : myTurn
                      ? 'Your turn. Make your mark!'
                      : 'Their turn. Plot your next move.'}
            </Text>
            {!finished && !away && (
              <Text style={s.turnSymbol}>{myTurn ? '✦' : '◌'}</Text>
            )}
          </View>
          <Board
            board={game.board}
            line={end.line}
            enabled={myTurn && !finished && !blocked}
            move={(cell) => onAction({ kind: 'move', cell })}
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
                  <Text style={s.rematchText}>{rivalName} wants a rematch</Text>
                  <View style={s.actions}>
                    <View style={s.flex}>
                      <Button
                        disabled={blocked}
                        onPress={() => onAction({ kind: 'accept' })}
                      >
                        Accept
                      </Button>
                    </View>
                    <View style={s.flex}>
                      <Button
                        secondary
                        disabled={blocked}
                        onPress={() => onAction({ kind: 'decline' })}
                      >
                        Decline
                      </Button>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <Button
                    disabled={blocked || game.rematch === me}
                    onPress={() => onAction({ kind: 'rematch' })}
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
              <Text style={s.smallCentered}>
                THREE IN A ROW. ALL THE GLORY.
              </Text>
              <Text style={s.smallCentered}>
                {game.scores.draws} {game.scores.draws === 1 ? 'draw' : 'draws'}{' '}
                · X and O alternate first move each round
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onLeave}
            style={s.leaveButton}
          >
            <Text style={s.leaveLink}>Leave & find someone new ↗</Text>
          </Pressable>
        </Arrive>
        <View style={s.brandFooter}>
          <Text style={s.footer}>✳ powered by Offline Protocol</Text>
          <Text style={s.footerDot}>•••</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  dot: {
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
  eyebrow: {
    fontFamily: font,
    color: C.muted,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.8,
  },
  smallCentered: {
    fontFamily: font,
    fontSize: 11,
    lineHeight: 18,
    color: C.muted,
    textAlign: 'center',
  },
  leaveButton: { padding: 13, alignItems: 'center' },
  leaveLink: {
    fontFamily: font,
    fontWeight: '600',
    fontSize: 12,
    color: '#777183',
  },
  brandFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 24,
    marginTop: 'auto',
  },
  footer: { fontFamily: font, fontSize: 9, color: '#A49FAB' },
  footerDot: { color: '#C4BDCE', letterSpacing: 3 },
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
    paddingHorizontal: 8,
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
  turnText: {
    flex: 1,
    fontFamily: font,
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
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
