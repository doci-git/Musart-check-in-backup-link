import fs from 'fs';
import * as admin from 'firebase-admin';

function parseArgs(argv) {
  const args = { tenantId: 'default', name: 'Default Tenant' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--tenantId=')) args.tenantId = a.split('=')[1];
    else if (a.startsWith('--name=')) args.name = a.substring('--name='.length);
    else if (a.startsWith('--adminEmail=')) args.adminEmail = a.split('=')[1];
    else if (a.startsWith('--dbURL=')) args.dbURL = a.split('=')[1];
    else if (a.startsWith('--sa=')) args.sa = a.split('=')[1];
  }
  return args;
}

function initAdmin({ dbURL, sa }) {
  const serviceAccountPath = sa || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.SA_KEY;
  if (serviceAccountPath) {
    const json = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(json),
      databaseURL: dbURL,
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: dbURL,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const defaultDbURL = 'https://multi-client-77378-default-rtdb.europe-west1.firebasedatabase.app';
  const dbURL = args.dbURL || defaultDbURL;
  initAdmin({ dbURL, sa: args.sa });

  const base = admin.database().ref(`tenants/${args.tenantId}`);
  await base.child('meta').update({
    name: args.name,
    createdAt: admin.database.ServerValue.TIMESTAMP,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  });

  if (args.adminEmail) {
    // Store admin allowlist as a map for flexibility
    await base.child('settings/admin_emails').update({ [args.adminEmail]: true });
  }

  console.log(`Seeded tenant '${args.tenantId}' (${args.name})`);
  if (args.adminEmail) console.log(`Added admin email: ${args.adminEmail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

