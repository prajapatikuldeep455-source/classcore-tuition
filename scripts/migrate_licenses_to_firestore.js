// scripts/migrate_licenses_to_firestore.js
// Migrates all licenses from licenses.json to Firebase Firestore 'licenses' collection

const fs = require('fs');
const path = require('path');

const projectId = 'classcore-e5d97';
const apiKey = 'AIzaSyB2XecFJhEMtOyGkUPPbkMZpAGbzJdwL3s';

const licensesFile = path.join(__dirname, '..', 'licenses.json');
if (!fs.existsSync(licensesFile)) {
  console.error('licenses.json not found at:', licensesFile);
  process.exit(1);
}

const licenses = JSON.parse(fs.readFileSync(licensesFile, 'utf8'));

async function uploadLicense(key, lic) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${key}?key=${apiKey}`;
  
  const body = {
    fields: {
      key: { stringValue: key },
      plan: { stringValue: lic.plan || 'monthly' },
      expiry: { integerValue: String(lic.expiry || 9999999999999) },
      name: { stringValue: lic.name || '' },
      institute: { stringValue: lic.institute || '' },
      mobile: { stringValue: lic.mobile || '' },
      email: { stringValue: lic.email || '' },
      expiryDate: { stringValue: String(lic.expiryDate || '') },
      issued: { stringValue: String(lic.issued || '') },
      status: { stringValue: 'active' },
      deviceId: { stringValue: lic.deviceId || '' },
      note: { stringValue: lic.note || '' }
    }
  };

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Failed to upload ${key}: ${resp.status} ${txt}`);
  }

  const result = await resp.json();
  console.log(`✅ Uploaded ${key} (${lic.name || 'User'}, Plan: ${lic.plan})`);
  return result;
}

async function main() {
  console.log(`Starting migration of ${Object.keys(licenses).length} licenses to Firebase Firestore...`);
  for (const [key, lic] of Object.entries(licenses)) {
    try {
      await uploadLicense(key, lic);
    } catch (e) {
      console.error(`❌ Error uploading ${key}:`, e.message);
    }
  }
  console.log('🎉 Migration completed successfully!');
}

main();
