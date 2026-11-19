import { it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, writeBatch, serverTimestamp, Timestamp, increment } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-chounou', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'meta/vanished'), { count: 10 }));
});
const vanish = (db, uid, by = 1, withPlayer = true) => {
  const b = writeBatch(db);
  b.update(doc(db, 'meta/vanished'), { count: increment(by) });
  if (withPlayer) b.set(doc(db, `players/${uid}`), { lastAt: serverTimestamp() });
  return b.commit();
};

it('authed +1 with player stamp succeeds', async () => {
  await assertSucceeds(vanish(env.authenticatedContext('u1').firestore(), 'u1'));
});
it('+2 fails', async () => { await assertFails(vanish(env.authenticatedContext('u1').firestore(), 'u1', 2)); });
it('unauthenticated fails', async () => { await assertFails(vanish(env.unauthenticatedContext().firestore(), 'anon')); });
it('count without player stamp fails', async () => { await assertFails(vanish(env.authenticatedContext('u1').firestore(), 'u1', 1, false)); });
it('second within 10s fails', async () => {
  const db = env.authenticatedContext('u1').firestore();
  await assertSucceeds(vanish(db, 'u1'));
  await assertFails(vanish(db, 'u1'));
});
it('after 10s succeeds again', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'players/u1'), { lastAt: Timestamp.fromMillis(Date.now() - 11000) }));
  await assertSucceeds(vanish(env.authenticatedContext('u1').firestore(), 'u1'));
});
it("writing someone else's player doc fails", async () => {
  await assertFails(vanish(env.authenticatedContext('u1').firestore(), 'u2'));
});
it('anyone can read the count', async () => {
  const { getDoc } = await import('firebase/firestore');
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'meta/vanished')));
});

// ---- 証明された者(全クリした人のニックネーム) ----
const clear = (db, uid, data) => setDoc(doc(db, `clearers/${uid}`), data);
it('a signed-in player can leave one nickname under their own uid', async () => {
  const db = env.authenticatedContext('u1').firestore();
  await assertSucceeds(clear(db, 'u1', { name: 'たろう', at: serverTimestamp() }));
  await assertFails(clear(db, 'u1', { name: 'じろう', at: serverTimestamp() })); // 上書き不可
});
it('nickname rules: own uid, short, no URLs, no extra fields', async () => {
  const db = env.authenticatedContext('u1').firestore();
  await assertFails(clear(db, 'u2', { name: 'x', at: serverTimestamp() }));
  await assertFails(clear(db, 'u1', { name: '', at: serverTimestamp() }));
  await assertFails(clear(db, 'u1', { name: 'a'.repeat(25), at: serverTimestamp() }));
  await assertFails(clear(db, 'u1', { name: 'http://spam', at: serverTimestamp() }));
  await assertFails(clear(db, 'u1', { name: 'x', at: serverTimestamp(), extra: 1 }));
  await assertFails(clear(env.unauthenticatedContext().firestore(), 'anon', { name: 'x', at: serverTimestamp() }));
});
it('anyone can read the list; nobody can delete from the app', async () => {
  const { getDocs, collection, deleteDoc } = await import('firebase/firestore');
  await assertSucceeds(getDocs(collection(env.unauthenticatedContext().firestore(), 'clearers')));
  const db = env.authenticatedContext('u1').firestore();
  await clear(db, 'u1', { name: 'x', at: serverTimestamp() });
  await assertFails(deleteDoc(doc(db, 'clearers/u1')));
});
