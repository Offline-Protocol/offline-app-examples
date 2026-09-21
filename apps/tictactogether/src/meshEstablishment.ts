import type OfflineProtocol from '@offline-protocol/mesh-sdk';

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wait until auto key exchange (or explicit establish) has a session path open. */
export async function waitForSecureSession(
  protocol: OfflineProtocol | null | undefined,
  peerId: string,
  timeoutMs = 60000,
): Promise<boolean> {
  if (!protocol) {
    return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await protocol.getEstablishmentState(peerId).catch(() => null);
    if (state === 'SessionConfirmed' || state === 'SessionPending') {
      return true;
    }
    if (state === 'HaveKeyPackage') {
      await protocol.establishSecureSession(peerId).catch(() => {});
    }
    await pause(300);
  }
  return false;
}

export async function awaitMeshEstablishment(
  protocol: OfflineProtocol | null | undefined,
  peerId: string,
  maxAttempts = 6,
): Promise<boolean> {
  if (!protocol) {
    return false;
  }
  let delay = 100;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const state = await protocol.getEstablishmentState(peerId).catch(() => null);
    if (state === 'HaveKeyPackage') {
      await protocol.establishSecureSession(peerId).catch(() => {});
    }
    if (state === 'SessionConfirmed' || state === 'SessionPending') {
      return true;
    }
    await pause(delay);
    delay = Math.min(delay * 2, 400);
  }
  return false;
}
