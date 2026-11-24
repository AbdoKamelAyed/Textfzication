import crypto from 'node:crypto';

const EPHEMERAL_SIGNING_SECRET = crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 10;

interface ClaimedAdminCredential {
  saltHex: string;
  hashHex: string;
  claimedAtIso: string;
  claimedByLabel: string;
}

export interface AdminTokenPayload {
  sub: string;
  role: 'admin';
  authMethod: 'server-passcode';
  iat: number;
  exp: number;
}

let claimedCredential: ClaimedAdminCredential | null = null;
const failedLoginBuckets = new Map<string, { count: number; resetAt: number }>();

function getSigningKey(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : EPHEMERAL_SIGNING_SECRET;
}

export function getEnvAdminPasscode(): string {
  return process.env.ADMIN_PASSCODE?.trim() ?? '';
}

export function getAdminAuthStatus() {
  const envConfigured = getEnvAdminPasscode().length > 0;
  const claimed = claimedCredential !== null;
  return {
    envPasscodeActive: envConfigured,
    claimedPasscodeActive: !envConfigured && claimed,
    needsFirstRunSetup: !envConfigured && !claimed,
    claimedAtIso: !envConfigured && claimedCredential ? claimedCredential.claimedAtIso : null,
  };
}

function hashPasscodeWithSalt(passcode: string, saltHex: string): string {
  return crypto.scryptSync(passcode, saltHex, 64).toString('hex');
}

function constantTimeMatchUtf8(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const entry = failedLoginBuckets.get(clientKey);
  if (!entry) return false;
  if (now > entry.resetAt) {
    failedLoginBuckets.delete(clientKey);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX_FAILURES;
}

export function recordFailedAttempt(clientKey: string): void {
  const now = Date.now();
  const current = failedLoginBuckets.get(clientKey);
  if (!current || now > current.resetAt) {
    failedLoginBuckets.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    current.count += 1;
  }
}

export function clearFailedAttempts(clientKey: string): void {
  failedLoginBuckets.delete(clientKey);
}

export function claimInitialAdminPasscode(
  passcode: string,
  claimedByLabel = 'Initial Admin'
): { ok: true; token: string; expiresAt: string } | { ok: false; status: number; error: string } {
  if (getEnvAdminPasscode().length > 0) {
    return {
      ok: false,
      status: 409,
      error: 'An environment ADMIN_PASSCODE secret is already active on this server.',
    };
  }
  if (claimedCredential !== null) {
    return {
      ok: false,
      status: 409,
      error: 'Initial admin passcode has already been claimed on this server.',
    };
  }
  const clean = passcode.trim();
  if (clean.length < 8 || clean.length > 128) {
    return {
      ok: false,
      status: 400,
      error: 'Admin passcode must be between 8 and 128 characters.',
    };
  }

  const saltHex = crypto.randomBytes(16).toString('hex');
  const hashHex = hashPasscodeWithSalt(clean, saltHex);
  claimedCredential = {
    saltHex,
    hashHex,
    claimedAtIso: new Date().toISOString(),
    claimedByLabel: claimedByLabel.trim().slice(0, 64) || 'Initial Admin',
  };

  const issued = issueAdminBearerToken(claimedCredential.claimedByLabel);
  return { ok: true, ...issued };
}

export function verifyAdminPasscode(passcode: string): boolean {
  const clean = passcode.trim();
  if (!clean) return false;

  const envPass = getEnvAdminPasscode();
  if (envPass.length > 0) {
    return constantTimeMatchUtf8(clean, envPass);
  }

  if (!claimedCredential) {
    return false;
  }

  const candidateHash = hashPasscodeWithSalt(clean, claimedCredential.saltHex);
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const expectedBuf = Buffer.from(claimedCredential.hashHex, 'hex');
  if (candidateBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

export function issueAdminBearerToken(subjectLabel = 'admin'): {
  token: string;
  expiresAt: string;
} {
  const iat = Date.now();
  const exp = iat + TOKEN_TTL_MS;
  const payload: AdminTokenPayload = {
    sub: subjectLabel.slice(0, 80) || 'admin',
    role: 'admin',
    authMethod: 'server-passcode',
    iat,
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedPayload)
    .digest('base64url');
  return {
    token: `tpadmin.${encodedPayload}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyAdminBearerToken(rawToken: string): AdminTokenPayload | null {
  const parts = rawToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'tpadmin') {
    return null;
  }
  const [, encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedPayload)
    .digest('base64url');

  const bufA = Buffer.from(providedSig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as AdminTokenPayload;
    if (
      parsed.role !== 'admin' ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
