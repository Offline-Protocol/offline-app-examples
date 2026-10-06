import { useMeshRelay, useNearbyRoom } from '@offline-app-examples/mesh';
import React, { useEffect, useRef, useState } from 'react';
import {
  newAlertId,
  parseStaffMessage,
  type StaffAlert,
  type StaffSession,
} from '../domain/staff';
import { RelayScreen } from '../ui/RelayScreen';
import { StaffReceiverScreen } from '../ui/StaffReceiverScreen';
import { StaffSenderScreen } from '../ui/StaffSenderScreen';

const APP_ID = 'eventfloor';

export type StaffRole = 'sender' | 'receiver' | 'relay';

export function StaffFlow({
  role,
  session,
  displayName,
  onLeave,
}: {
  role: StaffRole;
  session: StaffSession | null;
  displayName: string;
  onLeave: () => void;
}) {
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const relay = useMeshRelay(APP_ID);

  const room = useNearbyRoom({
    appId: APP_ID,
    group: true,
    onMessage: (_from, data) => {
      const msg = parseStaffMessage(data);
      if (!msg) return;
      if (msg.type === 'staff_alert') {
        setAlerts((prev) => {
          if (prev.some((a) => a.alertId === msg.alertId)) return prev;
          return [...prev, msg];
        });
      } else if (msg.type === 'staff_ack') {
        setAckedIds((prev) => new Set(prev).add(msg.alertId));
      }
    },
  });

  const me = { id: room.localId || relay.localId || 'me', name: displayName || 'Staff' };

  useEffect(() => {
    if (role === 'relay') {
      void relay.start(displayName || 'Crowd relay');
      return () => {
        void relay.leave();
      };
    }
    if (role === 'sender') {
      void room.host(`${session?.displayName ?? 'Staff'} · dispatch`);
    } else if (role === 'receiver') {
      void room.discover();
    }
    return () => {
      void room.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role !== 'receiver' || room.status !== 'discovering') return;
    const host = room.hosts[0];
    if (host) void room.join(host.id, session?.displayName ?? 'Staff');
  }, [role, room.status, room.hosts, session, room]);

  function sendAlert(section: string, body: string) {
    const staff = sessionRef.current;
    if (!staff || room.role !== 'host') return;
    const alert: StaffAlert = {
      type: 'staff_alert',
      alertId: newAlertId(),
      body: body.slice(0, 240),
      section,
      senderStaffId: staff.staffId,
      senderName: staff.displayName,
      senderUnit: staff.unit,
      createdAt: Date.now(),
    };
    setAlerts((prev) => [...prev, alert]);
    room.broadcast(alert).catch((e) => console.warn('staff broadcast failed', e));
  }

  function ackAlert(alert: StaffAlert) {
    const staff = sessionRef.current;
    if (!staff) return;
    const ack = {
      type: 'staff_ack' as const,
      alertId: alert.alertId,
      ackStaffId: staff.staffId,
      ackName: staff.displayName,
      at: Date.now(),
    };
    setAckedIds((prev) => new Set(prev).add(alert.alertId));
    const target = room.role === 'member' ? room.hostId : null;
    if (target) room.send(target, ack).catch(() => room.broadcast(ack));
    else room.broadcast(ack).catch((e) => console.warn('ack failed', e));
  }

  if (role === 'relay') {
    return (
      <RelayScreen
        relayName={displayName || 'Crowd relay'}
        neighbors={relay.neighborCount}
        me={me}
        hint="Place between staff sender and receiver when they are not in direct Bluetooth range."
        onLeave={() => {
          void relay.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'sender' && session && room.status === 'hosting') {
    return (
      <StaffSenderScreen
        session={session}
        me={me}
        people={room.peers}
        alerts={alerts}
        onSend={sendAlert}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'receiver' && session && (room.status === 'connected' || room.status === 'hosting')) {
    return (
      <StaffReceiverScreen
        session={session}
        me={me}
        people={room.peers}
        alerts={alerts}
        ackedIds={ackedIds}
        onAck={ackAlert}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  return null;
}
