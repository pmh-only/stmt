import { env } from '$env/dynamic/private';
import { error, redirect, type Cookies } from '@sveltejs/kit';
import { createLocalJWKSet, jwtVerify } from 'jose';
import type { JSONWebKeySet } from 'jose';
import { db } from './db';

const sessionCookie = 'stmt_session';
const day = 24 * 60 * 60 * 1000;

export type SessionUser = {
  subject: string;
  name: string;
  email: string;
};

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

let discoveryPromise: Promise<Discovery> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredEnv(name: string) {
  const value = env[name];
  if (!value) {
    error(500, `Missing ${name}`);
  }
  return value;
}

async function getDiscovery() {
  if (!discoveryPromise) {
    discoveryPromise = fetch(requiredEnv('OIDC_DISCOVERY_URL')).then(async (response) => {
      if (!response.ok) {
        error(500, 'OIDC discovery failed');
      }
      let metadata: unknown;
      try {
        metadata = await response.json();
      } catch {
        error(500, 'OIDC_DISCOVERY_URL did not return JSON');
      }
      if (!isRecord(metadata)) {
        error(500, 'OIDC_DISCOVERY_URL did not return an object');
      }
      if (Array.isArray(metadata.keys)) {
        error(500, 'OIDC_DISCOVERY_URL points to a JWKS endpoint, not an OpenID configuration document');
      }
      const discovery = {
        issuer: metadata.issuer,
        authorization_endpoint: metadata.authorization_endpoint,
        token_endpoint: metadata.token_endpoint,
        jwks_uri: metadata.jwks_uri
      };
      if (
        typeof discovery.issuer !== 'string' ||
        typeof discovery.authorization_endpoint !== 'string' ||
        typeof discovery.token_endpoint !== 'string' ||
        typeof discovery.jwks_uri !== 'string'
      ) {
        error(
          500,
          'OIDC_DISCOVERY_URL must point to an OpenID configuration document with issuer, authorization_endpoint, token_endpoint, and jwks_uri'
        );
      }
      try {
        new URL(discovery.authorization_endpoint);
        new URL(discovery.token_endpoint);
        new URL(discovery.jwks_uri);
      } catch {
        error(500, 'OIDC discovery endpoints must be absolute URLs');
      }
      return discovery as Discovery;
    });
  }
  return discoveryPromise;
}

async function getJwks(discovery: Discovery) {
  const response = await fetch(discovery.jwks_uri);
  if (!response.ok) {
    error(500, `OIDC JWKS fetch failed with HTTP ${response.status}`);
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    error(500, `OIDC JWKS endpoint did not return JSON: ${discovery.jwks_uri}`);
  }

  let jwks: { keys: unknown[] };
  if (isRecord(parsed) && Array.isArray(parsed.keys)) {
    jwks = { keys: parsed.keys };
  } else if (Array.isArray(parsed)) {
    jwks = { keys: parsed };
  } else if (isRecord(parsed) && typeof parsed.kty === 'string') {
    jwks = { keys: [parsed] };
  } else {
    error(500, `OIDC JWKS endpoint must return a JWKS keys array: ${discovery.jwks_uri}`);
  }

  try {
    return createLocalJWKSet(jwks as JSONWebKeySet);
  } catch {
    error(500, `OIDC JWKS endpoint returned malformed keys: ${discovery.jwks_uri}`);
  }
}

function randomToken(bytes = 32) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(digest).toString('base64url');
}

export async function buildLoginUrl(origin: string) {
  const discovery = await getDiscovery();
  const clientId = requiredEnv('OIDC_CLIENT_ID');
  const redirectUri = env.OIDC_REDIRECT_URI || `${origin}/auth/callback`;
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  db.prepare('DELETE FROM oauth_states WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO oauth_states (state, nonce, code_verifier, expires_at) VALUES (?, ?, ?, ?)').run(
    state,
    nonce,
    codeVerifier,
    Date.now() + 10 * 60 * 1000
  );

  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url;
}

export async function finishLogin(url: URL, cookies: Cookies) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    error(400, 'Missing OIDC callback parameters');
  }

  const row = db.prepare('SELECT nonce, code_verifier, expires_at FROM oauth_states WHERE state = ?').get(state) as
    | { nonce: string; code_verifier: string; expires_at: number }
    | undefined;
  db.prepare('DELETE FROM oauth_states WHERE state = ? OR expires_at < ?').run(state, Date.now());
  if (!row || row.expires_at < Date.now()) {
    error(400, 'OIDC login state expired');
  }

  const discovery = await getDiscovery();
  const clientId = requiredEnv('OIDC_CLIENT_ID');
  const redirectUri = env.OIDC_REDIRECT_URI || `${url.origin}/auth/callback`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: row.code_verifier
  });
  if (env.OIDC_CLIENT_SECRET) {
    body.set('client_secret', env.OIDC_CLIENT_SECRET);
  }

  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!tokenResponse.ok) {
    error(400, 'OIDC token exchange failed');
  }
  const tokenSet = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenSet.id_token) {
    error(400, 'OIDC provider did not return an id_token');
  }

  const jwks = await getJwks(discovery);
  const verified = await jwtVerify(tokenSet.id_token, jwks, {
    issuer: discovery.issuer,
    audience: clientId
  });
  const claims = verified.payload;
  if (claims.nonce !== row.nonce) {
    error(400, 'OIDC id_token nonce mismatch');
  }
  const subject = claims.sub;
  if (!subject) {
    error(400, 'OIDC id_token is missing subject');
  }

  const name = String(claims.name || claims.preferred_username || claims.email || subject);
  const email = String(claims.email || '');
  const sessionId = randomToken(48);
  const expiresAt = Date.now() + 30 * day;
  db.prepare('INSERT INTO sessions (id, subject, name, email, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    sessionId,
    subject,
    name,
    email,
    expiresAt
  );
  cookies.set(sessionCookie, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    expires: new Date(expiresAt)
  });
}

export function getSession(cookies: Cookies) {
  const sessionId = cookies.get(sessionCookie);
  if (!sessionId) return null;
  const session = db.prepare('SELECT subject, name, email, expires_at FROM sessions WHERE id = ?').get(sessionId) as
    | (SessionUser & { expires_at: number })
    | undefined;
  if (!session || session.expires_at < Date.now()) {
    cookies.delete(sessionCookie, { path: '/' });
    if (session) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }
  return { subject: session.subject, name: session.name, email: session.email };
}

export function logout(cookies: Cookies) {
  const sessionId = cookies.get(sessionCookie);
  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
  cookies.delete(sessionCookie, { path: '/' });
}

export function requireUser(user: SessionUser | null) {
  if (!user) {
    redirect(303, '/login');
  }
  return user;
}
