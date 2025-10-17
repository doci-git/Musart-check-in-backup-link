const admin = require('firebase-admin');
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall } = require('firebase-functions/v2/https');

try { admin.initializeApp(); } catch (e) {}

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

function requireAuth(context) {
  if (!context.auth) {
    throw new Error('unauthenticated');
  }
}


exports.openDoor = onCall(async (request) => {
  const { data, auth } = request;
  requireAuth(request);
  const tenantId = auth.token?.tenantId || data?.tenantId;
  if (!tenantId) throw new Error('permission-denied');
  const { deviceId, channel = 0, tokenId } = data || {};
  if (!deviceId) throw new Error('invalid-argument');
  const effectiveTenant = tenantId;
  if (!effectiveTenant) throw new Error('invalid-argument');

  // If the caller is not tenant-scoped (e.g., anonymous), require a valid secure link token
  if (!auth.token?.tenantId) {
    if (!tokenId) throw new Error('permission-denied');
    const linkSnap = await admin.database().ref(`tenants/${effectiveTenant}/secure_links/${tokenId}`).once('value');
    if (!linkSnap.exists()) throw new Error('permission-denied');
    const link = linkSnap.val();
    const nowTs = Date.now();
    const exhausted = (link.usedCount || 0) >= (link.maxUsage || 0);
    const expired = (link.expiration || 0) <= nowTs;
    const revoked = link.status !== 'active';
    if (revoked || expired || exhausted) throw new Error('permission-denied');
  }

  const snap = await admin.database().ref(`tenants/${effectiveTenant}/devices/${deviceId}`).once('value');
  const cfg = snap.val();
  if (!cfg || !cfg.auth_key) throw new Error('failed-precondition');
  const SHELLY_API_URL = 'https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch';
  const res = await fetch(SHELLY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: deviceId, auth_key: cfg.auth_key, channel, on: true, turn: 'on' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shelly error: ${res.status} ${res.statusText} ${text}`);
  }
  let payload = {};
  try { payload = await res.json(); } catch {}
  return { ok: true, payload };
});

