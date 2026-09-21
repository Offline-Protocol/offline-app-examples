import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MeshSession } from '../src/mesh';
import { SERVICE_NAME } from '../src/constants';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../src/debug', () => ({
  meshLog: jest.fn(),
  meshWarn: jest.fn(),
  meshError: jest.fn(),
  shortPeer: (s: string) => s,
}));
jest.mock('@offline-protocol/mesh-sdk', () => ({
  __esModule: true,
  default: jest.fn(),
  MeshServices: jest.fn().mockImplementation(() => ({
    discoverServices: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue('query'),
  })),
  MessagePriority: { High: 1, Critical: 2 },
}));

function setup(host = false) {
  const mesh = new MeshSession(host, jest.fn());
  const protocol = {
    isMlsInitialized: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue(true),
    mlsGetOrCreateKeyPackage: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ keyPackageData: [1] }),
    mlsImportKeyPackage: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue(undefined),
    sendMessage: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue('message'),
    sendConnectionRequest: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue('request'),
    acceptConnectionRequest: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue('accept'),
    rejectConnectionRequest: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue('reject'),
    getEstablishmentState: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue('SessionPending'),
    establishSecureSession: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue(undefined),
    getTopology: jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ local_user_id: 'off1local', links: [] }),
  };
  // Inject the native boundary while exercising the actual adapter and session.
  const adapter = mesh as any;
  adapter.protocol = protocol;
  mesh.ready = true;
  const emit = (event: object) => adapter.onEvent(event);
  const neighbor = (peer = 'off1host') =>
    emit({ type: 'neighbor_discovered', peer_id: peer, transport: 'ble' });
  const listing = (peer = 'off1host') =>
    emit({
      type: 'service_discovered',
      provider_peer_id: peer,
      service_id: SERVICE_NAME,
      version: '1',
      hop_count: 1,
      capabilities: { lobby: 'lobby', name: 'Host' },
    });
  return { mesh, adapter, protocol, emit, neighbor, listing };
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test('only service hosts are listed, even after identity verification', async () => {
  const p = setup();
  p.neighbor();
  await jest.advanceTimersByTimeAsync(5000);
  p.emit({
    type: 'security_warning',
    reason_code: 'TRANSPORT_IDENTITY_MISMATCH',
    peer_id: 'off1host',
  });
  expect(p.mesh.nearby).toHaveLength(0);
  p.listing();
  expect(p.mesh.nearby.map((s) => s.peer)).toEqual(['off1host']);
  expect(p.mesh.peerReadyForJoin('off1host')).toBe(true);
});
test('secure session marks peer ready before neighbor settle', () => {
  const p = setup();
  p.neighbor('off1host');
  p.listing('off1host');
  expect(p.mesh.peerReadyForJoin('off1host')).toBe(false);
  p.emit({ type: 'secure_session_established', peer_id: 'off1host' });
  expect(p.mesh.peerReadyForJoin('off1host')).toBe(true);
});
test('service arriving before neighbor is listed when neighbor arrives', () => {
  const p = setup();
  p.listing();
  expect(p.mesh.nearby).toHaveLength(0);
  p.neighbor();
  expect(p.mesh.nearby[0].reachable).toBe(true);
});
test('identity warning does not remove other reachable hosts', () => {
  const p = setup();
  p.neighbor('off1other');
  p.listing('off1other');
  p.emit({
    type: 'security_warning',
    reason_code: 'TRANSPORT_IDENTITY_MISMATCH',
    peer_id: 'off1host',
  });
  expect(p.mesh.nearbyPeers).toContain('off1other');
});
test('failed initial control request retries without abandoning the join', async () => {
  const p = setup();
  p.neighbor();
  p.listing();
  await jest.advanceTimersByTimeAsync(2000);
  p.protocol.sendConnectionRequest.mockRejectedValueOnce(
    new Error('temporarily unavailable'),
  );
  const request = p.mesh.requestJoin('off1host');
  await jest.advanceTimersByTimeAsync(1200);
  await request;
  expect(p.mesh.session.view.phase).toBe('connecting');
  const retry = p.adapter.resendJoinTransport('off1host', 'lobby');
  await jest.advanceTimersByTimeAsync(1200);
  await retry;
  expect(p.protocol.sendConnectionRequest).toHaveBeenCalledTimes(2);
});
test('neighbor loss and unrelated BLE messages cannot abort or redirect a join', () => {
  const p = setup();
  p.mesh.session.connect('off1host', 'lobby');
  p.emit({ type: 'neighbor_lost', peer_id: 'off1host' });
  expect(p.mesh.session.view.phase).toBe('connecting');
  p.emit({
    type: 'message_received',
    sender: 'off1stranger',
    content: '{}',
    transport: 'ble',
    hop_count: 1,
  });
  expect(p.mesh.session.opponentPeer()).toBe('off1host');
});
test('accept requires a tap and publishes state even if SDK acceptance fails', async () => {
  const p = setup(true);
  const content = JSON.stringify({
    v: 1,
    type: 'join',
    lobby: p.mesh.session.lobby,
    join: 'join-token',
  });
  p.emit({
    type: 'message_received',
    sender: 'off1guest',
    content,
    transport: 'ble',
    hop_count: 1,
  });
  expect(p.mesh.session.view.phase).toBe('waiting');
  expect(p.mesh.incomingRequests).toHaveLength(1);
  p.protocol.acceptConnectionRequest.mockRejectedValueOnce(
    new Error('no SDK request yet'),
  );
  await p.mesh.acceptRequest('off1guest');
  expect(p.mesh.session.view.phase).toBe('active');
  expect(
    p.protocol.sendMessage.mock.calls.some(
      ([m]) => JSON.parse(m.content).type === 'state',
    ),
  ).toBe(true);
  p.emit({
    type: 'connection_request_received',
    sender: 'off1guest',
    initial_message: content,
  });
  expect(p.protocol.rejectConnectionRequest).not.toHaveBeenCalled();
});
test('acceptance stops control requests while session retries the lost snapshot', async () => {
  const p = setup();
  p.mesh.session.connect('off1host', 'lobby');
  p.emit({ type: 'connection_accepted', accepted_by: 'off1host' });
  await p.adapter.resendJoinTransport('off1host', 'lobby');
  expect(p.protocol.sendConnectionRequest).not.toHaveBeenCalled();
  p.mesh.session.tick();
  expect(p.mesh.session.view.phase).toBe('connecting');
});
