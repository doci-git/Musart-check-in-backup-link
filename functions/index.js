import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Initialize Admin SDK once
try {
  admin.initializeApp();
} catch {}

// Helper to assert auth
function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
}

// Callable: create or update a tenant container
export const createTenant = functions.region('europe-west1').https.onCall(async (data, context) => {
  requireAuth(context);
  const { tenantId, name } = data || {};
  const isSuper = context.auth?.token?.isSuperAdmin === true;
  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only super admins can create tenants');
  }
  if (!tenantId || typeof tenantId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId is required');
  }
  const now = Date.now();
  await admin.database().ref(`tenants/${tenantId}/meta`).update({
    name: name || tenantId,
    createdAt: admin.database.ServerValue.TIMESTAMP,
    updatedAt: now,
  });
  return { ok: true };
});

// Callable: assign a user to a tenant via email
export const setUserTenantByEmail = functions.region('europe-west1').https.onCall(async (data, context) => {
  requireAuth(context);
  const isSuper = context.auth?.token?.isSuperAdmin === true;
  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only super admins can set user tenants');
  }
  const { email, tenantId, role } = data || {};
  if (!email || !tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'email and tenantId are required');
  }
  const user = await admin.auth().getUserByEmail(String(email));
  const claims = {
    ...(user.customClaims || {}),
    tenantId,
    role: role || 'admin'
  };
  await admin.auth().setCustomUserClaims(user.uid, claims);
  // Mirror membership in RTDB
  await admin.database().ref(`tenants/${tenantId}/members/${user.uid}`).set({
    email: user.email,
    role: claims.role,
    updatedAt: admin.database.ServerValue.TIMESTAMP
  });
  return { ok: true, uid: user.uid };
});

// Callable: open a door via Shelly Cloud API with server-side credentials
export const openDoor = functions.region('europe-west1').https.onCall(async (data, context) => {
  requireAuth(context);
  const tenantId = context.auth?.token?.tenantId;
  const isSuper = context.auth?.token?.isSuperAdmin === true;
  if (!tenantId && !isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Missing tenant');
  }
  const { deviceId, channel = 0 } = data || {};
  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId is required');
  }

  // Read device secret from RTDB under the caller's tenant
  const effectiveTenant = tenantId || data?.tenantId;
  if (!effectiveTenant) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId missing');
  }
  const snap = await admin.database().ref(`tenants/${effectiveTenant}/devices/${deviceId}`).once('value');
  const cfg = snap.val();
  if (!cfg || !cfg.auth_key) {
    throw new functions.https.HttpsError('failed-precondition', 'Device not configured');
  }

  const SHELLY_API_URL = 'https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch';

  // Use global fetch in Node 18
  const res = await fetch(SHELLY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: deviceId,
      auth_key: cfg.auth_key,
      channel,
      on: true,
      turn: 'on',
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new functions.https.HttpsError('internal', `Shelly error: ${res.status} ${res.statusText} ${text}`);
  }
  let payload = {};
  try { payload = await res.json(); } catch {}
  return { ok: true, payload };
});

// Callable: list tenants (super admin only)
export const listTenants = functions.region('europe-west1').https.onCall(async (_data, context) => {
  requireAuth(context);
  const isSuper = context.auth?.token?.isSuperAdmin === true;
  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only super admins can list tenants');
  }
  const snap = await admin.database().ref('tenants').once('value');
  const tenants = snap.val() || {};
  const result = Object.entries(tenants).map(([id, t]) => ({
    id,
    name: t?.meta?.name || id,
    createdAt: t?.meta?.createdAt || null,
    updatedAt: t?.meta?.updatedAt || null,
  }));
  return { ok: true, tenants: result };
});

// Callable: set device configuration (auth_key) for a tenant
export const setDeviceConfig = functions.region('europe-west1').https.onCall(async (data, context) => {
  requireAuth(context);
  const isSuper = context.auth?.token?.isSuperAdmin === true;
  const { tenantId, deviceId, auth_key } = data || {};
  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only super admins can configure devices');
  }
  if (!tenantId || !deviceId || !auth_key) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId, deviceId and auth_key are required');
  }
  await admin.database().ref(`tenants/${tenantId}/devices/${deviceId}`).set({ auth_key });
  return { ok: true };
});

// Callable: grant super admin to a user by email (super admin only)
export const setSuperAdminByEmail = functions.region('europe-west1').https.onCall(async (data, context) => {
  requireAuth(context);
  const isSuper = context.auth?.token?.isSuperAdmin === true;
  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only super admins can grant super admin');
  }
  const { email, value } = data || {};
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'email is required');
  }
  const user = await admin.auth().getUserByEmail(String(email));
  const claims = {
    ...(user.customClaims || {}),
    isSuperAdmin: value === false ? false : true,
  };
  await admin.auth().setCustomUserClaims(user.uid, claims);
  return { ok: true, uid: user.uid, isSuperAdmin: claims.isSuperAdmin };
});
