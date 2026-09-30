import '@offline-app-examples/ui/global.css';
import { useNearbyRoom } from '@offline-app-examples/mesh';
import { NearbyLobby, PortalHost } from '@offline-app-examples/ui';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Action,
  initialMatch,
  Match,
  parseMessage,
  play,
  transition,
} from './src/domain';
import { GameScreen } from './src/ui/GameScreen';
import { Board, colors } from './src/ui/Playful';

const APP_ID = 'tictactogether';
// Safety net for a message lost on the radio while the link still looked fine.
const RESEND_MS = 5000;

const stateOf = (m: Match) => ({ type: 'state', ...m });
const warn = (error: unknown) =>
  console.warn('[tictactogether] send failed', error);

// The host plays X and owns the match; the first phone to join plays O.
// Rules and message validation are in src/domain; this file wires them to the room.
export default function App() {
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [rivalName, setRivalName] = useState('');
  // Kept in a ref too, so room callbacks always read the latest value.
  const [match, setMatchState] = useState(initialMatch);
  const matchRef = useRef(match);
  // Member: the action sent to the host, until a newer state confirms it.
  const [pending, setPending] = useState<{ rev: number; action: Action }>();
  // Host: the O player dropped out of range (the room may bring them back).
  const rivalAway = useRef(false);

  const setMatch = (m: Match) => {
    matchRef.current = m;
    setMatchState(m);
  };

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (from, data) => {
      const msg = parseMessage(data); // never trust the radio
      const current = matchRef.current;
      if (msg?.type === 'action' && room.role === 'host') {
        if (from !== current.o) return;
        const next =
          msg.rev === current.rev ? play(current, 'O', msg.action) : null;
        // Applied: the effect below broadcasts it. Stale or duplicate: resend the truth.
        if (next) setMatch(next);
        else room.send(from, stateOf(current)).catch(warn);
      } else if (msg?.type === 'state' && room.role === 'member') {
        if (msg.rev < current.rev) return;
        if (msg.o && msg.o !== room.localId) {
          setNotice('That game already has two players. Try another host.');
          room.leave();
          return;
        }
        setMatch(msg);
        setPending((p) => (p && msg.rev > p.rev ? undefined : p));
      }
    },
    // Also fires when a peer comes back into range.
    onPeerJoined: (peer) => {
      if (room.role !== 'host') return;
      const current = matchRef.current;
      if (peer.id === current.o) {
        rivalAway.current = false;
      } else if (!current.o || rivalAway.current) {
        // First rival, or the old one is gone and someone new is here: fresh game.
        rivalAway.current = false;
        setRivalName(peer.name);
        setMatch({ ...initialMatch(), rev: current.rev + 1, o: peer.id });
      }
      // Everyone else learns from `o` that the game is full.
      room.send(peer.id, stateOf(matchRef.current)).catch(warn);
    },
    onPeerLeft: (peer) => {
      if (peer.id === matchRef.current.o) rivalAway.current = true;
    },
  });

  const { role, hostId, broadcast, send } = room;
  const connected = room.peers.length > 0;

  // Host: every new revision goes to everyone, then again every few seconds.
  useEffect(() => {
    if (role !== 'host' || !match.o) return;
    const push = () => broadcast(stateOf(match)).catch(warn);
    push();
    const timer = setInterval(push, RESEND_MS);
    return () => clearInterval(timer);
  }, [role, broadcast, match]);

  // Member: repeat the pending action until the host answers. Duplicates are
  // harmless, the host only applies an action tagged with its current revision.
  useEffect(() => {
    if (!pending || !hostId || !connected) return;
    const push = () => send(hostId, { type: 'action', ...pending }).catch(warn);
    push();
    const timer = setInterval(push, RESEND_MS);
    return () => clearInterval(timer);
  }, [pending, hostId, connected, send]);

  const act = (action: Action) => {
    if (role === 'host') {
      const next = play(matchRef.current, 'X', action);
      if (next) setMatch(next);
    } else if (!pending) {
      setPending({ rev: match.rev, action });
    }
  };

  const reset = () => {
    setMatch(initialMatch());
    setPending(undefined);
    setNotice('');
    setRivalName('');
    rivalAway.current = false;
  };

  const isHost = role === 'host';
  const inGame = isHost
    ? room.status === 'hosting' && !!match.o
    : room.status === 'connected' && match.o === room.localId;
  // Member: show its own move right away; the host's next state confirms it.
  const game = pending
    ? (transition(match.game, 'O', pending.action) ?? match.game)
    : match.game;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {inGame ? (
        <GameScreen
          game={game}
          me={isHost ? 'X' : 'O'}
          rivalName={rivalName || (isHost ? 'Guest' : 'Host')}
          syncing={!!pending}
          away={isHost ? !room.peers.some((p) => p.id === match.o) : !connected}
          onAction={act}
          onLeave={room.leave}
        />
      ) : (
        <NearbyLobby
          title="Tic Tac Together"
          tagline="A classic game. A nearby friend. No internet needed."
          illustration={
            <View style={{ width: 190, marginBottom: 12 }}>
              <Board
                board={['X', null, 'O', null, 'X', null, 'O', null, 'X']}
                line={[]}
                enabled={false}
                move={() => {}}
                decorative
              />
            </View>
          }
          accentColor={colors.coral}
          status={room.status}
          error={room.error || notice}
          hosts={room.hosts}
          peers={room.peers}
          joiningId={hostId ?? undefined}
          name={name}
          onNameChange={setName}
          onHost={() => {
            reset();
            room.host(name);
          }}
          onDiscover={() => {
            reset();
            room.discover();
          }}
          onJoin={(host) => {
            setRivalName(host.name);
            room.join(host.id, name);
          }}
          onCancel={room.leave}
          labels={{
            host: 'Host game',
            join: 'Join game',
            hostingTitle: 'You’re hosting',
            waiting: 'Waiting for your rival…',
            scanningTitle: 'Find your rival',
            scanningHint:
              'Games nearby show up here. The other phone taps Host game.',
            connected: 'Joined! Setting up the board…',
          }}
        />
      )}
      <PortalHost />
    </SafeAreaProvider>
  );
}
