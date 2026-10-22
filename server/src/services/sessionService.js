/**
 * sessionService.js
 *
 * Single-device session enforcement — all timing is server-side.
 * The core operation is claimSession(): a single atomic findOneAndUpdate
 * that can never produce a race condition (no read-then-write).
 *
 * Constants (also exposed so Settings page can show them):
 *   HEARTBEAT_SECONDS     15  (client sends heartbeat every ~15s ±3s jitter)
 *   LEASE_SECONDS         75  (overridable per-system in SystemSettings)
 *   PAGEHIDE_GRACE_SECONDS 12 (soft-release shrinks lease to this)
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { SessionEvent } from '../models/SessionEvent.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { env } from '../config/env.js';

// ─── Named constants ─────────────────────────────────────────────────────────
export const HEARTBEAT_SECONDS = 15;
export const DEFAULT_LEASE_SECONDS = 75;
export const PAGEHIDE_GRACE_SECONDS = 12;
const BLOCKED_LOGIN_RATE_LIMIT = 20; // max per student per hour
const WAIT_TOKEN_SECONDS = 180;       // 3-minute waitToken lifetime

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a random hex string of `bytes` bytes */
function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Mask an IP address (replace last octet(s) with 'x') */
export function maskIp(ip) {
  if (!ip) return null;
  // IPv4: mask last octet
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) return `${v4[1]}.x.x`;
  // IPv6: mask last 4 groups
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + ':x:x:x:x';
    }
  }
  return 'x.x.x.x';
}

/** Build a human-readable device label from User-Agent string */
export function buildDeviceLabel(ua) {
  if (!ua) return 'Unknown device';
  // Browser
  let browser = 'Browser';
  if (/Chrome\/(\d+)/i.test(ua) && !/Chromium|OPR|Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\/(\d+)/i.test(ua)) browser = 'Firefox';
  else if (/Edg\/(\d+)/i.test(ua)) browser = 'Edge';
  else if (/OPR\/(\d+)/i.test(ua)) browser = 'Opera';
  else if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  // OS / device
  let os = 'Desktop';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';
  return `${browser} on ${os}`;
}

/** Get the currently configured lease seconds from DB (with in-memory cache) */
let _leaseCache = null;
let _leaseCacheAt = 0;
const LEASE_CACHE_TTL_MS = 30_000;

export async function getLeaseSeconds() {
  const now = Date.now();
  if (_leaseCache !== null && now - _leaseCacheAt < LEASE_CACHE_TTL_MS) {
    return _leaseCache;
  }
  const settings = await SystemSettings.findOne().select('leaseSeconds singleDeviceSignIn').lean();
  _leaseCache = settings?.leaseSeconds ?? DEFAULT_LEASE_SECONDS;
  _leaseCacheAt = now;
  return _leaseCache;
}

/** Invalidate the lease cache (call after Settings update) */
export function invalidateLeaseCache() {
  _leaseCache = null;
  _leaseCacheAt = 0;
}

/** Check if single-device sign-in is enabled in Settings */
export async function isSingleDeviceEnabled() {
  const settings = await SystemSettings.findOne().select('singleDeviceSignIn').lean();
  // Default ON if no settings doc yet
  return settings?.singleDeviceSignIn !== false;
}

// ─── Issue / verify waitToken ─────────────────────────────────────────────────

export function signWaitToken(studentId, examId, nonce) {
  return jwt.sign(
    {
      purpose: 'session_wait',
      studentId: studentId.toString(),
      examId: examId ? examId.toString() : null,
      nonce,
    },
    env.JWT_SECRET,
    { expiresIn: WAIT_TOKEN_SECONDS }
  );
}

/** Returns the decoded payload or throws */
export function verifyWaitToken(token) {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (payload.purpose !== 'session_wait') {
    const e = new Error('Invalid wait token purpose');
    e.code = 'INVALID_WAIT_TOKEN';
    throw e;
  }
  return payload;
}

// ─── SessionEvent helpers ─────────────────────────────────────────────────────

/** Log a session event, respecting the blocked_login rate limit */
export async function logSessionEvent({ studentId, examId, attemptId, type, deviceLabel, ipMasked }) {
  try {
    if (type === 'blocked_login') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await SessionEvent.countDocuments({
        studentId,
        type: 'blocked_login',
        at: { $gte: oneHourAgo },
      });
      if (recentCount >= BLOCKED_LOGIN_RATE_LIMIT) return; // silently drop
    }
    await SessionEvent.create({ studentId, examId, attemptId, type, at: new Date(), deviceLabel, ipMasked });
  } catch {
    // Non-critical — never let audit logging break the login flow
  }
}

// ─── ATOMIC CLAIM ─────────────────────────────────────────────────────────────

/**
 * claimSession(studentId, deviceKey, ctx) — ONE atomic operation.
 *
 * Returns:
 *   { claimed: true,  sessionId, newSession } on success
 *   { claimed: false } when ACCOUNT_IN_USE
 *
 * Eligible to claim when ANY of:
 *  1. No activeSession exists
 *  2. activeSession.status === 'released'
 *  3. activeSession.leaseExpiresAt <= now  (expired)
 *  4. activeSession.deviceKeyHash === hash(deviceKey)  (same-device reclaim)
 */
export async function claimSession(studentId, deviceKey, { examId, attemptId, ua, ip } = {}) {
  const leaseSeconds = await getLeaseSeconds();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);

  const deviceKeyHash = User.hashDeviceKey(deviceKey);
  const newSessionId = randomHex(16); // 128-bit random
  const deviceLabel = buildDeviceLabel(ua);
  const ipMasked = maskIp(ip);

  // Conditions under which a claim is allowed (all in one findOneAndUpdate):
  // - no session at all
  // - OR status released
  // - OR lease expired
  // - OR same device (same deviceKeyHash)
  const claimCondition = {
    _id: studentId,
    $or: [
      { 'activeSession.sessionId': null },
      { 'activeSession.status': 'released' },
      { 'activeSession.leaseExpiresAt': { $lte: now } },
      { 'activeSession.deviceKeyHash': deviceKeyHash },
    ],
  };

  const result = await User.findOneAndUpdate(
    claimCondition,
    {
      $set: {
        'activeSession.sessionId': newSessionId,
        'activeSession.deviceKeyHash': deviceKeyHash,
        'activeSession.deviceLabel': deviceLabel,
        'activeSession.ipMasked': ipMasked,
        'activeSession.examId': examId || null,
        'activeSession.attemptId': attemptId || null,
        'activeSession.startedAt': now,
        'activeSession.lastSeenAt': now,
        'activeSession.leaseExpiresAt': leaseExpiresAt,
        'activeSession.status': 'active',
        'activeSession.releasedAt': null,
        'activeSession.releaseReason': null,
        'activeSession.blockedCount': 0,
      },
    },
    { new: true, projection: { 'activeSession': 1 } }
  );

  if (!result) {
    // Another session is active — increment blocked count
    await User.updateOne(
      { _id: studentId },
      { $inc: { 'activeSession.blockedCount': 1 } }
    );
    return { claimed: false };
  }

  return { claimed: true, sessionId: newSessionId, deviceLabel };
}

// ─── RELEASE ─────────────────────────────────────────────────────────────────

/**
 * releaseSession(studentId, sessionId, reason)
 *
 * Marks the session as released so the next claim can succeed immediately.
 * Only releases if the sessionId matches (prevents stale tokens from
 * releasing a freshly claimed session).
 */
export async function releaseSession(studentId, sessionId, reason = 'logout') {
  const now = new Date();
  const result = await User.updateOne(
    { _id: studentId, 'activeSession.sessionId': sessionId },
    {
      $set: {
        'activeSession.status': 'released',
        'activeSession.releasedAt': now,
        'activeSession.releaseReason': reason,
        // Set leaseExpiresAt to now so expiry checks also pass
        'activeSession.leaseExpiresAt': now,
      },
    }
  );
  return result.modifiedCount > 0;
}

// ─── SOFT-RELEASE (pagehide beacon) ──────────────────────────────────────────

/**
 * softReleaseSession(studentId, sessionId)
 *
 * Shrinks leaseExpiresAt to min(current, now + PAGEHIDE_GRACE_SECONDS).
 * A page refresh will renew it via heartbeat; a closed tab frees the account
 * after ~12 seconds.
 */
export async function softReleaseSession(studentId, sessionId) {
  const graceDeadline = new Date(Date.now() + PAGEHIDE_GRACE_SECONDS * 1000);
  await User.updateOne(
    {
      _id: studentId,
      'activeSession.sessionId': sessionId,
      'activeSession.status': 'active',
      // Only shorten, never extend
      'activeSession.leaseExpiresAt': { $gt: graceDeadline },
    },
    {
      $set: { 'activeSession.leaseExpiresAt': graceDeadline },
    }
  );
}

// ─── RENEW (heartbeat / autosave) ────────────────────────────────────────────

/**
 * renewLease(studentId, sessionId)
 *
 * Sliding-renews the lease. Works even if the lease had already lapsed
 * (as long as nobody has claimed since — i.e., sessionId still matches).
 *
 * Returns:
 *   { renewed: true, blockedSinceLast } on success
 *   { renewed: false } when the sid no longer matches (SESSION_REPLACED)
 */
export async function renewLease(studentId, sessionId) {
  const leaseSeconds = await getLeaseSeconds();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);

  const doc = await User.findOneAndUpdate(
    { _id: studentId, 'activeSession.sessionId': sessionId },
    {
      $set: {
        'activeSession.leaseExpiresAt': leaseExpiresAt,
        'activeSession.lastSeenAt': now,
        'activeSession.status': 'active',
      },
      // Snapshot then reset the blocked counter atomically
      $set: { 'activeSession.leaseExpiresAt': leaseExpiresAt, 'activeSession.lastSeenAt': now, 'activeSession.status': 'active' },
    },
    { new: false, projection: { 'activeSession.blockedCount': 1 } }
  );

  if (!doc) return { renewed: false };

  const blockedSinceLast = doc.activeSession?.blockedCount ?? 0;

  // Reset blocked count after reading it
  if (blockedSinceLast > 0) {
    await User.updateOne(
      { _id: studentId, 'activeSession.sessionId': sessionId },
      { $set: { 'activeSession.blockedCount': 0 } }
    );
  }

  return { renewed: true, blockedSinceLast };
}
