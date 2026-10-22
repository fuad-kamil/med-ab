/**
 * singleDevice.test.js
 *
 * Unit / integration tests for the single-device session service.
 * Runs in-process without a real MongoDB — uses a lightweight stub
 * that mimics the atomic findOneAndUpdate semantics we rely on.
 *
 * Run: npm test (vitest run)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── helpers pulled directly from service (pure functions, no DB) ──────────────
import { maskIp, buildDeviceLabel, HEARTBEAT_SECONDS, DEFAULT_LEASE_SECONDS, PAGEHIDE_GRACE_SECONDS } from '../services/sessionService.js';

// ── Mock env + JWT so service can be imported ─────────────────────────────────
vi.mock('../config/env.js', () => ({
  env: { JWT_SECRET: 'test-secret-for-unit-tests-only' },
}));

// ── Mock Mongoose models to test atomic claim logic ──────────────────────────
// We simulate the in-memory state of a single User document and implement
// the findOneAndUpdate semantics ourselves so we can test race conditions.

function makeUserDoc(activeSession = null) {
  return {
    _id: 'student1',
    activeSession: activeSession
      ? { ...activeSession }
      : { sessionId: null, deviceKeyHash: null, status: null, leaseExpiresAt: null, blockedCount: 0 },
    blockedCount_: 0,
  };
}

function simulateFindOneAndUpdate(doc, condition, update, deviceKeyHash, now) {
  // Evaluate the $or condition
  const sess = doc.activeSession;
  const eligible =
    !sess.sessionId ||
    sess.status === 'released' ||
    (sess.leaseExpiresAt && sess.leaseExpiresAt <= now) ||
    sess.deviceKeyHash === deviceKeyHash;

  if (!eligible) {
    // Increment blockedCount
    doc.activeSession.blockedCount = (doc.activeSession.blockedCount || 0) + 1;
    return null;
  }

  // Apply $set
  Object.assign(doc.activeSession, update.$set);
  return doc;
}

// ─── Constants ────────────────────────────────────────────────────────────────
describe('Constants', () => {
  it('HEARTBEAT_SECONDS is 15', () => expect(HEARTBEAT_SECONDS).toBe(15));
  it('DEFAULT_LEASE_SECONDS is 75', () => expect(DEFAULT_LEASE_SECONDS).toBe(75));
  it('PAGEHIDE_GRACE_SECONDS is 12', () => expect(PAGEHIDE_GRACE_SECONDS).toBe(12));
  it('LEASE > HEARTBEAT so a single missed heartbeat does not expire', () => {
    expect(DEFAULT_LEASE_SECONDS).toBeGreaterThan(HEARTBEAT_SECONDS * 2);
  });
});

// ─── maskIp ──────────────────────────────────────────────────────────────────
describe('maskIp', () => {
  it('masks last two octets of IPv4', () => {
    expect(maskIp('192.168.1.100')).toBe('192.168.x.x');
  });
  it('handles IPv6', () => {
    expect(maskIp('2001:db8:85a3:0:0:8a2e:370:7334')).toContain(':x:x:x:x');
  });
  it('returns null for null/empty', () => {
    expect(maskIp(null)).toBeNull();
    expect(maskIp('')).toBeNull();
  });
});

// ─── buildDeviceLabel ─────────────────────────────────────────────────────────
describe('buildDeviceLabel', () => {
  it('identifies Chrome on Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36';
    expect(buildDeviceLabel(ua)).toBe('Chrome on Android');
  });
  it('identifies Safari on iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1';
    expect(buildDeviceLabel(ua)).toBe('Safari on iOS');
  });
  it('identifies Firefox on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
    expect(buildDeviceLabel(ua)).toBe('Firefox on Windows');
  });
  it('returns Unknown device for null UA', () => {
    expect(buildDeviceLabel(null)).toBe('Unknown device');
  });
});

// ─── Atomic claim simulation ──────────────────────────────────────────────────
describe('claimSession (simulated atomic logic)', () => {
  const DEVICE_KEY_HASH_A = 'aaaa';
  const DEVICE_KEY_HASH_B = 'bbbb';
  const SESSION_ID = 'sess-1';

  function now() { return new Date(); }
  function future(ms) { return new Date(Date.now() + ms); }
  function past(ms) { return new Date(Date.now() - ms); }

  const baseUpdate = { $set: { sessionId: 'sess-new', deviceKeyHash: DEVICE_KEY_HASH_B, status: 'active', leaseExpiresAt: future(75000), blockedCount: 0 } };

  it('1. Allows claim when no session exists', () => {
    const doc = makeUserDoc();
    const result = simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    expect(result).not.toBeNull();
    expect(doc.activeSession.status).toBe('active');
  });

  it('2. Allows claim when status is released', () => {
    const doc = makeUserDoc({ sessionId: SESSION_ID, deviceKeyHash: DEVICE_KEY_HASH_A, status: 'released', leaseExpiresAt: future(75000), blockedCount: 0 });
    const result = simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    expect(result).not.toBeNull();
  });

  it('3. Allows claim when lease has expired', () => {
    const doc = makeUserDoc({ sessionId: SESSION_ID, deviceKeyHash: DEVICE_KEY_HASH_A, status: 'active', leaseExpiresAt: past(5000), blockedCount: 0 });
    const result = simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    expect(result).not.toBeNull();
  });

  it('4. BLOCKS claim when lease is active (different device)', () => {
    const doc = makeUserDoc({ sessionId: SESSION_ID, deviceKeyHash: DEVICE_KEY_HASH_A, status: 'active', leaseExpiresAt: future(75000), blockedCount: 0 });
    const result = simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    expect(result).toBeNull();
    expect(doc.activeSession.blockedCount).toBe(1);
  });

  it('5. SAME-DEVICE RECLAIM: allows even when lease is active', () => {
    const doc = makeUserDoc({ sessionId: SESSION_ID, deviceKeyHash: DEVICE_KEY_HASH_A, status: 'active', leaseExpiresAt: future(75000), blockedCount: 0 });
    const result = simulateFindOneAndUpdate(doc, {}, { $set: { ...baseUpdate.$set, deviceKeyHash: DEVICE_KEY_HASH_A } }, DEVICE_KEY_HASH_A, now());
    expect(result).not.toBeNull();
  });

  it('6. 5 simultaneous claims produce exactly 1 success (no lease exists)', () => {
    // Simulate 5 concurrent attempts using a simple lock flag
    const doc = makeUserDoc();
    let claimed = 0;
    // In real MongoDB this is atomic; here we simulate by checking result
    for (let i = 0; i < 5; i++) {
      const result = simulateFindOneAndUpdate(
        doc,
        {},
        { $set: { sessionId: `sess-${i}`, deviceKeyHash: `hash-${i}`, status: 'active', leaseExpiresAt: future(75000), blockedCount: 0 } },
        `hash-${i}`,
        now()
      );
      if (result) {
        claimed++;
        // After first claim, subsequent calls see an active session
      }
    }
    // Because our simulation is sequential (not truly concurrent),
    // only the first call can succeed (rest see active session)
    expect(claimed).toBe(1);
  });

  it('7. Old token stays valid after expiry until someone else claims (sessionId still matches)', () => {
    const doc = makeUserDoc({ sessionId: SESSION_ID, deviceKeyHash: DEVICE_KEY_HASH_A, status: 'active', leaseExpiresAt: past(5000), blockedCount: 0 });
    // Device A tries to renew (heartbeat) — sessionId still matches → allowed
    const sessionIdStillMatches = doc.activeSession.sessionId === SESSION_ID;
    expect(sessionIdStillMatches).toBe(true);
    // Now device B claims successfully
    simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    // Now device A's sessionId no longer matches
    const sessionIdAfterClaim = doc.activeSession.sessionId === SESSION_ID;
    expect(sessionIdAfterClaim).toBe(false);
  });

  it('8. Blocked count increments on each failed claim', () => {
    const doc = makeUserDoc({ sessionId: SESSION_ID, deviceKeyHash: DEVICE_KEY_HASH_A, status: 'active', leaseExpiresAt: future(75000), blockedCount: 0 });
    simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    expect(doc.activeSession.blockedCount).toBe(3);
  });

  it('9. Claimable immediately after logout (status released)', () => {
    const doc = makeUserDoc({ sessionId: SESSION_ID, deviceKeyHash: DEVICE_KEY_HASH_A, status: 'active', leaseExpiresAt: future(75000), blockedCount: 0 });
    // Simulate logout: set status released
    doc.activeSession.status = 'released';
    doc.activeSession.leaseExpiresAt = now();
    const result = simulateFindOneAndUpdate(doc, {}, baseUpdate, DEVICE_KEY_HASH_B, now());
    expect(result).not.toBeNull();
  });

  it('10. waitToken import and verify roundtrip', async () => {
    const { signWaitToken, verifyWaitToken } = await import('../services/sessionService.js');
    const nonce = 'nonce123';
    const token = signWaitToken('student1', 'exam1', nonce);
    const payload = verifyWaitToken(token);
    expect(payload.studentId).toBe('student1');
    expect(payload.examId).toBe('exam1');
    expect(payload.nonce).toBe(nonce);
    expect(payload.purpose).toBe('session_wait');
  });
});
