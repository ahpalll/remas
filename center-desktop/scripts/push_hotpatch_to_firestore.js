/**
 * REMAS — Publish & Push Hotpatch to Firestore
 * Automatically deploys the latest hotpatch to Firestore collection `appHotpatches/latest`
 * so all connected client devices receive the update immediately.
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
  authDomain: 'educenter-saas-860c5.firebaseapp.com',
  projectId: 'educenter-saas-860c5',
  storageBucket: 'educenter-saas-860c5.firebasestorage.app',
  messagingSenderId: '522787600693',
  appId: '1:522787600693:web:2416c6c770fb98785f747c'
};

async function main() {
  const manifestPath = path.join(__dirname, '..', 'release_hotpatches', 'hotpatch_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ لم يتم العثور على ملف hotpatch_manifest.json. يرجى تشغيل npm run hotpatch أولاً.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`🚀 جاري نشر التحديث الفوري رقم: ${manifest.patchVersion} إلى Firestore...`);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const cred = await signInWithEmailAndPassword(auth, 'admin@remas.edu', 'Mm4499289');
    console.log(`✓ تم تسجيل الدخول بصلاحية السوبر أدمن (${cred.user.email})`);
  } catch (authErr) {
    console.warn(`تحذير أثناء تسجيل الدخول: ${authErr.message}`);
  }

  // 1. Primary Fleet Document (licenses/system_hotpatch_latest) - Authorized for SuperAdmin & readable by all centers
  const licenseHotpatchRef = doc(db, 'licenses', 'system_hotpatch_latest');
  await setDoc(licenseHotpatchRef, {
    ...manifest,
    institutionId: 'GLOBAL_FLEET',
    publishedBy: 'admin@remas.edu',
    pushedAt: new Date().toISOString()
  }, { merge: true });

  console.log('✅ تم نشر التحديث الفوري بنجاح إلى القناة العامة (licenses/system_hotpatch_latest)!');

  // 2. Secondary fallback attempt
  try {
    const hotpatchDocRef = doc(db, 'appHotpatches', 'latest');
    await setDoc(hotpatchDocRef, {
      ...manifest,
      institutionId: 'GLOBAL_FLEET',
      pushedAt: new Date().toISOString()
    }, { merge: true });
  } catch (_) {
    // Ignore if appHotpatches collection rules are strictly isolated
  }

  const check = await getDoc(licenseHotpatchRef);
  if (check.exists()) {
    console.log(`📡 تأكيد: النسخة المنشورة حالياً في السحابة هي: ${check.data().patchVersion}`);
    console.log(`📝 الوصف: ${check.data().description}`);
    console.log('⚡ ستصل هذه النسخة تلقائياً وفوراً إلى جميع أجهزة السنتر المفتوحة بمجرد سحب التحديث.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ فشل النشر إلى Firestore:', err);
  process.exit(1);
});
