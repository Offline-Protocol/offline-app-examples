import { useMeshRelay, useNearbyRoom } from '@offline-app-examples/mesh';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createDemoFloodAlert } from '../domain/alerts';
import { ingestToNorthwind, unsyncedCheckInIds } from '../domain/platform';
import type { EmployeeSession } from '../domain/roster';
import {
  buildCheckInProposal,
  checkInForEmployee,
  emptySoc,
  emptyStaffHandset,
  parseRollcallMessage,
  pendingResend,
  snapshotOf,
  socReducer,
  staffReducer,
  type CheckInRecord,
  type CheckInStatus,
} from '../domain/rollcall';
import { loadPersisted, savePersisted, sanitizeSoc, sanitizeStaff } from '../services/persist';
import { ConnectingScreen } from '../ui/common';
import { RelayScreen } from '../ui/RelayScreen';
import { SocConsoleScreen } from '../ui/SocConsoleScreen';
import { StaffHandsetScreen } from '../ui/StaffHandsetScreen';

const APP_ID = 'saferoll';
const RESEND_MS = 8_000;

export type SafeRollRole = 'soc' | 'staff' | 'relay';

export function SafeRollFlow({
  role,
  consoleName,
  employee,
  onLeave,
}: {
  role: SafeRollRole;
  consoleName: string;
  employee: EmployeeSession | null;
  onLeave: () => void;
}) {
  const [soc, setSoc] = useState(emptySoc);
  const [staff, setStaff] = useState(emptyStaffHandset);
  const [northwindStored, setNorthwindStored] = useState<Set<string>>(new Set());

  const socRef = useRef(soc);
  const staffRef = useRef(staff);
  const northwindRef = useRef(northwindStored);
  const pendingRecords = useRef<Map<string, CheckInRecord>>(new Map());

  socRef.current = soc;
  staffRef.current = staff;
  northwindRef.current = northwindStored;

  useEffect(() => {
    loadPersisted().then((p) => {
      if (p.soc) setSoc(sanitizeSoc(p.soc));
      if (p.staff) setStaff(sanitizeStaff(p.staff));
      if (p.northwindStoredCheckInIds) setNorthwindStored(new Set(p.northwindStoredCheckInIds));
    });
  }, []);

  const persist = useCallback(() => {
    savePersisted({
      soc: socRef.current,
      staff: staffRef.current,
      northwindStoredCheckInIds: [...northwindRef.current],
    });
  }, []);

  const relay = useMeshRelay(APP_ID);

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (_from, data) => {
      const msg = parseRollcallMessage(data);
      if (!msg) return;

      if (room.role === 'host') {
        if (msg.type === 'propose') {
          const next = socReducer(socRef.current, { type: 'propose', record: msg.record });
          if (next !== socRef.current) {
            socRef.current = next;
            setSoc(next);
            broadcast(snapshotOf(next));
            persist();
          }
        }
      } else if (msg.type === 'snapshot') {
        staffRef.current = staffReducer(staffRef.current, {
          type: 'snapshot',
          rev: msg.rev,
          activeAlert: msg.activeAlert,
          checkIns: msg.checkIns,
          syncedCheckInIds: msg.syncedCheckInIds,
          northwindDuplicatesDropped: msg.northwindDuplicatesDropped,
          cloudLinkOnline: msg.cloudLinkOnline,
          myEmployeeId: employee?.employeeId ?? '',
        });
        for (const [checkInId] of pendingRecords.current.entries()) {
          const confirmed = msg.checkIns.find((c) => c.checkInId === checkInId);
          if (confirmed) {
            staffRef.current = staffReducer(staffRef.current, {
              type: 'submitted',
              record: confirmed,
            });
            pendingRecords.current.delete(checkInId);
          }
        }
        setStaff(staffRef.current);
        persist();
      }
    },
    onPeerJoined: (peer) => {
      if (room.role === 'host') send(peer.id, snapshotOf(socRef.current));
      else resend();
    },
  });

  const send = (peerId: string, data: unknown) =>
    room.send(peerId, data).catch((e) => console.warn('send failed', e));
  const broadcast = (data: unknown) =>
    room.broadcast(data).catch((e) => console.warn('broadcast failed', e));

  function resend() {
    for (const id of pendingResend(staffRef.current)) {
      const record = pendingRecords.current.get(id);
      if (record) broadcast({ type: 'propose', record });
    }
  }

  useEffect(() => {
    if (role === 'relay') {
      void relay.start(consoleName || 'Mesh relay');
      return () => {
        void relay.leave();
      };
    }
    if (role === 'soc') {
      void room.host(consoleName || 'SOC console');
    } else if (role === 'staff') {
      void room.discover();
    }
    return () => {
      void room.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role !== 'staff' || room.status !== 'discovering') return;
    const lead = room.hosts[0];
    if (lead) void room.join(lead.id, consoleName || 'Staff');
  }, [role, room.status, room.hosts, consoleName, room]);

  useEffect(() => {
    if (role !== 'staff' || room.status !== 'connected') return;
    const timer = setInterval(resend, RESEND_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, room.status]);

  function setCloudLink(online: boolean) {
    const next = socReducer(socRef.current, { type: 'set_cloud_link', online });
    socRef.current = next;
    setSoc(next);
    broadcast(snapshotOf(next));
    persist();
  }

  function publishDemoAlert() {
    if (!socRef.current.cloudLinkOnline) return;
    const alert = createDemoFloodAlert();
    const next = socReducer(socRef.current, { type: 'set_alert', alert });
    socRef.current = next;
    setSoc(next);
    broadcast(snapshotOf(next));
    persist();
  }

  function syncNorthwind() {
    const ids = unsyncedCheckInIds(socRef.current.checkIns, socRef.current.syncedCheckInIds);
    const batch = ids.length > 0 ? ids : socRef.current.checkIns.map((c) => c.checkInId);
    const { next, result } = ingestToNorthwind(northwindRef.current, batch);
    northwindRef.current = next;
    setNorthwindStored(next);
    const socNext = socReducer(socRef.current, {
      type: 'mark_synced',
      checkInIds: result.accepted,
      duplicatesDropped: result.duplicatesDropped,
    });
    socRef.current = socNext;
    setSoc(socNext);
    broadcast(snapshotOf(socNext));
    persist();
  }

  function submitCheckIn(status: CheckInStatus) {
    if (!employee) return;
    const alert = staffRef.current.activeAlert;
    if (!alert || !staffRef.current.alertTrusted) return;

    const existing = checkInForEmployee(staffRef.current.checkIns, alert.alertId, employee.employeeId);
    if (existing) {
      staffRef.current = staffReducer(staffRef.current, { type: 'submitted', record: existing });
      setStaff(staffRef.current);
      return;
    }

    const record = buildCheckInProposal({
      alertId: alert.alertId,
      employeeId: employee.employeeId,
      displayName: employee.displayName,
      office: employee.office,
      status,
      deviceId: room.localId || 'staff',
    });
    if (!record) return;

    if (room.role === 'host') {
      const next = socReducer(socRef.current, { type: 'propose', record });
      socRef.current = next;
      setSoc(next);
      broadcast(snapshotOf(next));
      staffRef.current = staffReducer(staffRef.current, { type: 'submitted', record });
      setStaff(staffRef.current);
      persist();
      return;
    }

    pendingRecords.current.set(record.checkInId, record);
    staffRef.current = staffReducer(staffRef.current, { type: 'queue', checkInId: record.checkInId });
    setStaff(staffRef.current);
    broadcast({ type: 'propose', record });
    persist();
  }

  const me = {
    id: room.localId || relay.localId || 'me',
    name: role === 'staff' ? employee?.displayName ?? consoleName : consoleName,
  };

  if (role === 'relay') {
    return (
      <RelayScreen
        relayName={consoleName || 'Mesh relay'}
        neighbors={relay.neighborCount}
        me={me}
        onLeave={() => {
          void relay.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'soc' && room.status === 'hosting') {
    return (
      <SocConsoleScreen
        consoleName={consoleName}
        soc={soc}
        northwindTotal={northwindStored.size}
        people={room.peers}
        onToggleCloudLink={setCloudLink}
        onPullAlert={publishDemoAlert}
        onSyncNorthwind={syncNorthwind}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'staff' && employee && (room.status === 'connected' || room.status === 'joining')) {
    return (
      <StaffHandsetScreen
        employee={employee}
        staff={staff}
        people={room.peers}
        me={me}
        onCheckIn={submitCheckIn}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  const leaveSession = () => {
    void room.leave();
    onLeave();
  };

  let message = 'Turn on Bluetooth and keep devices in range.';
  if (role === 'soc') {
    message = 'Starting the SOC console and advertising over Bluetooth…';
  } else if (role === 'staff') {
    if (!employee) {
      message = 'Staff sign-in required.';
    } else if (room.status === 'discovering' && room.hosts.length === 0) {
      message = 'Looking for the SOC console nearby. Start the SOC on another phone first.';
    } else if (room.status === 'joining') {
      message = 'Joining the SOC mesh…';
    } else {
      message = 'Connecting to the SOC console…';
    }
  }

  return (
    <ConnectingScreen
      message={message}
      error={room.status === 'error' ? room.error : undefined}
      onLeave={leaveSession}
    />
  );
}
