import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

const UPSTREAM_ORIGIN = 'https://streampw.studypanda.live';
const BRAND_NAME = 'GB STUDY';
const TELEGRAM_URL = 'https://t.me/GBFreestudy';
const CUSTOM_ICON_PAGE_URL = 'https://ibb.co/0R7qc34v';
const CUSTOM_ICON_DIRECT_URL = 'https://i.ibb.co/Q3g9fGSt/1791541921524.png';
const LOCAL_ICON_PATH = '/gb-study-icon.png';

const PORT = Number(process.env.PORT) || 3000;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface CachedIcon {
  buffer: Buffer;
  contentType: string;
  fetchedAt: number;
}

let cachedIcon: CachedIcon | null = null;
const ICON_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

async function resolveDirectIconUrl(): Promise<string> {
  try {
    const res = await fetch(CUSTOM_ICON_PAGE_URL, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT },
    });
    if (res.ok) {
      const html = await res.text();
      const ogMatch = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogMatch?.[1]?.startsWith('https://i.ibb.co/')) {
        return ogMatch[1];
      }
    }
  } catch {
    // Fall back to known direct URL
  }
  return CUSTOM_ICON_DIRECT_URL;
}

async function getCustomIcon(): Promise<CachedIcon | null> {
  const now = Date.now();
  if (cachedIcon && now - cachedIcon.fetchedAt < ICON_CACHE_TTL_MS) {
    return cachedIcon;
  }

  const candidates = [CUSTOM_ICON_DIRECT_URL];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': DEFAULT_USER_AGENT },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') || 'image/png';
        cachedIcon = {
          buffer: Buffer.from(arrayBuf),
          contentType,
          fetchedAt: now,
        };
        return cachedIcon;
      }
    } catch {
      // Try resolved fallback below
    }
  }

  try {
    const resolved = await resolveDirectIconUrl();
    const res = await fetch(resolved, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT },
    });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') || 'image/png';
      cachedIcon = {
        buffer: Buffer.from(arrayBuf),
        contentType,
        fetchedAt: now,
      };
      return cachedIcon;
    }
  } catch {
    // Ignore
  }

  return cachedIcon;
}

function rewriteBrandContent(text: string): string {
  return (
    text
      // Neutralize upstream frame-buster so preview iframe & embeds render cleanly
      // Applied identically to HTML and RSC payloads to prevent React hydration mismatch
      .replace(/if\s*\(\s*window\.top\s*!==\s*window\.self\s*\)/g, 'if (false)')
      // Replace icon URLs (both absolute and relative)
      .replace(/https?:\/\/studypanda\.live\/icon-192x192\.png/gi, LOCAL_ICON_PATH)
      .replace(/https?:\/\/streampw\.studypanda\.live\/icon-192x192\.png/gi, LOCAL_ICON_PATH)
      .replace(/(["'`(])\/icon-192x192\.png/gi, `$1${LOCAL_ICON_PATH}`)
      // Replace Telegram channel URLs
      .replace(/https?:\/\/t\.me\/\+cksVWUi0uOs1YjJl/gi, TELEGRAM_URL)
      .replace(/https?:\/\/t\.me\/\+[A-Za-z0-9_-]+/g, TELEGRAM_URL)
      .replace(/("tg_channel"\s*:\s*)"[^"]*"/g, `$1"${TELEGRAM_URL}"`)
      .replace(/(\\"tg_channel\\"\s*:\s*\\")[^"\\]*(\\")/g, `$1${TELEGRAM_URL}$2`)
      .replace(/("tgChannel"\s*:\s*)"[^"]*"/g, `$1"${TELEGRAM_URL}"`)
      .replace(/(\\"tgChannel\\"\s*:\s*\\")[^"\\]*(\\")/g, `$1${TELEGRAM_URL}$2`)
      // Replace brand name
      .replace(/StudyPanda/g, BRAND_NAME)
      .replace(/Study Panda/g, BRAND_NAME)
      .replace(/STUDYPANDA/g, BRAND_NAME)
  );
}

const SHARED_SESSION_FILE = path.resolve(process.cwd(), '.gb-shared-session.json');

interface SharedSessionData {
  accessToken: string;
  refreshToken: string;
  updatedAt: number;
}

let sharedSession: SharedSessionData = {
  accessToken: process.env.SHARED_ACCESS_TOKEN || '',
  refreshToken: process.env.SHARED_REFRESH_TOKEN || '',
  updatedAt: 0,
};

async function loadSharedSessionFromDisk(): Promise<void> {
  if (sharedSession.accessToken || sharedSession.refreshToken) {
    return;
  }
  try {
    const raw = await fs.readFile(SHARED_SESSION_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SharedSessionData>;
    if (parsed.accessToken || parsed.refreshToken) {
      sharedSession = {
        accessToken: String(parsed.accessToken || ''),
        refreshToken: String(parsed.refreshToken || ''),
        updatedAt: Number(parsed.updatedAt || Date.now()),
      };
    }
  } catch {
    // No saved shared session yet
  }
}

async function saveSharedSessionToDisk(): Promise<void> {
  try {
    await fs.writeFile(
      SHARED_SESSION_FILE,
      JSON.stringify(
        {
          accessToken: sharedSession.accessToken,
          refreshToken: sharedSession.refreshToken,
          updatedAt: sharedSession.updatedAt,
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.warn('Failed to persist shared session:', err);
  }
}

function hasSharedSession(): boolean {
  return Boolean(sharedSession.accessToken || sharedSession.refreshToken);
}

function updateSharedSessionTokens(accessToken?: string, refreshToken?: string): boolean {
  let changed = false;
  if (accessToken && accessToken !== sharedSession.accessToken) {
    sharedSession.accessToken = accessToken;
    changed = true;
  }
  if (refreshToken && refreshToken !== sharedSession.refreshToken) {
    sharedSession.refreshToken = refreshToken;
    changed = true;
  }
  if (changed) {
    sharedSession.updatedAt = Date.now();
    void saveSharedSessionToDisk();
  }
  return changed;
}

function captureSharedTokensFromCookieHeader(cookieHeader: string | undefined): void {
  if (!cookieHeader) return;
  const map = parseCookieMap(cookieHeader);
  const accessToken = map.get('accessToken');
  const refreshToken = map.get('refreshToken');
  // Only auto-capture from incoming browser cookies when no shared session is saved yet,
  // or when the matching token refreshes.
  if (!hasSharedSession() && (accessToken || refreshToken)) {
    updateSharedSessionTokens(accessToken, refreshToken);
  }
}

function captureSharedTokensFromSetCookies(setCookies: string[]): void {
  if (setCookies.length === 0) return;
  const map = new Map<string, string>();
  mergeSetCookiesIntoMap(setCookies, map);
  const accessToken = map.get('accessToken');
  const refreshToken = map.get('refreshToken');
  if (accessToken || refreshToken) {
    updateSharedSessionTokens(accessToken, refreshToken);
  }
}

function applySharedSessionToCookieHeader(rawCookieHeader: string): string {
  if (!hasSharedSession()) return rawCookieHeader;
  const map = parseCookieMap(rawCookieHeader);
  if (sharedSession.accessToken) {
    map.set('accessToken', sharedSession.accessToken);
  }
  if (sharedSession.refreshToken) {
    map.set('refreshToken', sharedSession.refreshToken);
  }
  return serializeCookieMap(map);
}

function filterSensitiveSetCookiesForBrowser(setCookies: string[]): string[] {
  if (!hasSharedSession()) return setCookies;
  return setCookies.filter((raw) => {
    const firstPair = raw.split(';')[0]?.trim().toLowerCase() || '';
    return !firstPair.startsWith('accesstoken=') && !firstPair.startsWith('refreshtoken=');
  });
}

const SENSITIVE_PII_KEY_RE =
  /^(phone|phoneNumber|mobile|mobileNumber|primaryNumber|whatsappNumber|contactNumber|email|otp)$/i;

function rewriteJsonValue(data: unknown, targetPath = ''): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => rewriteJsonValue(item, targetPath));
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const updated: Record<string, unknown> = {};
    const isAuthOrProfile =
      targetPath.startsWith('/api/AboutMe') || targetPath.startsWith('/api/auth/');

    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_PII_KEY_RE.test(key)) {
        updated[key] = '';
      } else if (
        isAuthOrProfile &&
        (key === 'firstName' || key === 'lastName' || key === 'username' || key === 'userName')
      ) {
        updated[key] = key === 'lastName' ? '' : 'GB STUDY';
      } else if (key === 'webName' || key === 'sidebarTitle') {
        updated[key] = BRAND_NAME;
      } else if (key === 'sidebarLogoUrl') {
        updated[key] = LOCAL_ICON_PATH;
      } else if (key === 'tg_channel' || key === 'tgChannel') {
        updated[key] = TELEGRAM_URL;
      } else if (typeof value === 'string') {
        updated[key] = rewriteBrandContent(value);
      } else {
        updated[key] = rewriteJsonValue(value, targetPath);
      }
    }

    if (targetPath === '/api/auth/serverInfo') {
      updated.sharedLogin = hasSharedSession();
    }

    return updated;
  }
  if (typeof data === 'string') {
    return rewriteBrandContent(data);
  }
  return data;
}

function rewriteSetCookie(cookie: string, isHttps: boolean): string {
  const parts = cookie.split(';').map((p) => p.trim());
  const filtered = parts.filter((part) => {
    const lower = part.toLowerCase();
    return (
      !lower.startsWith('domain=') &&
      !lower.startsWith('samesite=') &&
      lower !== 'secure' &&
      lower !== 'partitioned'
    );
  });

  if (isHttps) {
    filtered.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    filtered.push('SameSite=Lax');
  }

  return filtered.join('; ');
}

function isTextRewritableContentType(contentType: string): {
  isJson: boolean;
  isHtmlOrRsc: boolean;
  isJsChunk: boolean;
} {
  const lower = contentType.toLowerCase();
  if (lower.includes('application/json')) {
    return { isJson: true, isHtmlOrRsc: false, isJsChunk: false };
  }
  if (lower.includes('text/html') || lower.includes('text/x-component')) {
    return { isJson: false, isHtmlOrRsc: true, isJsChunk: false };
  }
  if (lower.includes('javascript')) {
    return { isJson: false, isHtmlOrRsc: false, isJsChunk: true };
  }
  return { isJson: false, isHtmlOrRsc: false, isJsChunk: false };
}

function rewriteJsChunk(code: string): string {
  // When an API call returns 401 and triggers window.location.href="/auth",
  // keep the fetch promise pending during navigation so callers don't race and throw
  // "Failed to fetch batches" before the redirect completes.
  const target =
    'return 401===a.status&&"/auth"!==window.location.pathname&&(console.warn("Session expired or unauthorized (401). Redirecting to /auth..."),window.location.href="/auth"),a';
  const replacement =
    'if(401===a.status&&"/auth"!==window.location.pathname){console.warn("Session expired or unauthorized (401). Redirecting to /auth...");window.location.href="/auth";return new Promise(()=>{})}return a';
  if (code.includes(target)) {
    return code.replace(target, replacement);
  }
  return code;
}

function hasSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:accessToken|refreshToken)=[^;\s]+/.test(cookieHeader);
}

function isSpaUiRoute(pathname: string): boolean {
  if (
    pathname === '/' ||
    pathname === '/auth' ||
    pathname === '/study' ||
    pathname === '/study/' ||
    pathname === '/study/batches' ||
    pathname === '/study/mybatches' ||
    pathname === '/history' ||
    pathname === '/contact'
  ) {
    return true;
  }
  return pathname.startsWith('/study/batches/');
}

function buildUpstreamHeaders(req: Request, targetPath: string): Headers {
  const headers = new Headers();

  const skipRequestHeaders = new Set([
    'host',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'te',
    'trailer',
    'upgrade',
    'content-length',
    'accept-encoding',
    'origin',
    'referer',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-forwarded-port',
    'forwarded',
    'via',
    'sec-fetch-site',
  ]);

  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (skipRequestHeaders.has(lowerKey) || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
    } else {
      headers.set(key, value);
    }
  }

  const incomingUa = req.headers['user-agent'];
  if (!incomingUa || incomingUa.toLowerCase().includes('curl')) {
    headers.set('user-agent', DEFAULT_USER_AGENT);
  }

  headers.set('host', new URL(UPSTREAM_ORIGIN).host);
  headers.set('origin', UPSTREAM_ORIGIN);
  headers.set('sec-fetch-site', 'same-origin');

  // Map browser Referer path onto upstream origin so upstream anti-proxy checks pass
  let refererPath = targetPath;
  const rawReferer = req.headers.referer;
  if (typeof rawReferer === 'string') {
    try {
      const parsed = new URL(rawReferer);
      refererPath = parsed.pathname + parsed.search;
    } catch {
      refererPath = targetPath;
    }
  }
  headers.set('referer', `${UPSTREAM_ORIGIN}${refererPath}`);
  headers.set('accept-encoding', 'gzip, deflate, br');

  return headers;
}

const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'content-encoding',
  'content-length',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'report-to',
  'reporting-endpoints',
  'nel',
  'set-cookie',
]);

const KEY_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEY_RENEW_BEFORE_EXPIRY_MS = 10 * 60 * 1000; // Renew 10 minutes before expiry
const KEY_SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const KEY_ENTRY_MAX_IDLE_MS = 30 * 24 * 60 * 60 * 1000; // Prune after 30 days of inactivity

interface VerifiedKeyEntry {
  sessionKey: string;
  batchId: string;
  cookieHeader: string;
  userAgent: string;
  verifiedAt: number;
  expiresAt: number;
  lastSeenAt: number;
}

interface AutoVerifyResult {
  ok: boolean;
  redirectTo: string;
  setCookies: string[];
  updatedCookieHeader: string;
}

const verifiedKeyRegistry = new Map<string, VerifiedKeyEntry>();
const inFlightAutoVerifications = new Map<string, Promise<AutoVerifyResult>>();

function parseCookieMap(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (name) map.set(name, val);
  }
  return map;
}

function serializeCookieMap(map: Map<string, string>): string {
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function mergeSetCookiesIntoMap(setCookies: string[], map: Map<string, string>): void {
  for (const rawCookie of setCookies) {
    const firstPair = rawCookie.split(';')[0]?.trim();
    if (!firstPair) continue;
    const eqIdx = firstPair.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = firstPair.slice(0, eqIdx).trim();
    const val = firstPair.slice(eqIdx + 1).trim();
    if (name) map.set(name, val);
  }
}

function getSessionIdentityKey(cookieMap: Map<string, string>): string {
  const anonId = cookieMap.get('anon_id');
  if (anonId) return `anon:${anonId}`;
  const accessToken = cookieMap.get('accessToken');
  if (accessToken) return `tok:${accessToken.slice(-24)}`;
  const refreshToken = cookieMap.get('refreshToken');
  if (refreshToken) return `ref:${refreshToken.slice(-24)}`;
  return 'default';
}

function extractBatchIdFromRequest(url: URL, referer?: string): string {
  const fromQuery = url.searchParams.get('batchId') || url.searchParams.get('BatchId');
  if (fromQuery) return fromQuery;

  const pathMatch = url.pathname.match(/^\/study\/batches\/([^/?#]+)/);
  if (pathMatch?.[1]) return pathMatch[1];

  if (referer) {
    try {
      const refUrl = new URL(referer);
      const refQuery = refUrl.searchParams.get('batchId') || refUrl.searchParams.get('BatchId');
      if (refQuery) return refQuery;
      const refPathMatch = refUrl.pathname.match(/^\/study\/batches\/([^/?#]+)/);
      if (refPathMatch?.[1]) return refPathMatch[1];
    } catch {
      // Ignore malformed referer
    }
  }
  return '';
}

function normalizeRelativeLocation(rawLocation: string | null): string | null {
  if (!rawLocation) return null;
  let cleaned = rawLocation.trim();
  if (cleaned.startsWith(UPSTREAM_ORIGIN)) {
    cleaned = cleaned.slice(UPSTREAM_ORIGIN.length) || '/';
  }
  return cleaned;
}

function cleanVerifiedRedirectUrl(rawLocation: string | null, batchId: string): string {
  const normalized = normalizeRelativeLocation(rawLocation);
  if (!normalized) {
    return batchId ? `/study/batches/${encodeURIComponent(batchId)}` : '/study/batches';
  }
  try {
    const parsed = new URL(normalized, UPSTREAM_ORIGIN);
    parsed.searchParams.delete('toast');
    return parsed.pathname + parsed.search;
  } catch {
    return batchId ? `/study/batches/${encodeURIComponent(batchId)}` : '/study/batches';
  }
}

function detectKeyGenerateRedirect(upstreamRes: globalThis.Response, bodyText?: string): string | null {
  const location = normalizeRelativeLocation(upstreamRes.headers.get('location'));
  if (location && location.startsWith('/key-generate')) {
    return location;
  }

  const nextjsRedirect = upstreamRes.headers.get('x-nextjs-redirect');
  if (nextjsRedirect) {
    const candidate = normalizeRelativeLocation(nextjsRedirect.split(';')[0] || '');
    if (candidate && candidate.startsWith('/key-generate')) {
      return candidate;
    }
  }

  if (bodyText) {
    const rscRedirectMatch = bodyText.match(
      /NEXT_REDIRECT;(?:replace|push);(\/key-generate[^;\\"\s<]*)/
    );
    if (rscRedirectMatch?.[1]) {
      return rscRedirectMatch[1];
    }
    const metaRefreshMatch = bodyText.match(/url=(\/key-generate[^"'\s<>]+)/i);
    if (metaRefreshMatch?.[1]) {
      return metaRefreshMatch[1].replace(/&amp;/g, '&');
    }
  }

  return null;
}

function extractKeyGenTokenAndAnonId(body: string): { token: string; anonId: string } {
  const tokenMatch = body.match(/(?:\\"|")token(?:\\"|")\s*:\s*(?:\\"|")([^"\\]+)(?:\\"|")/);
  const anonMatch = body.match(/(?:\\"|")anon_id(?:\\"|")\s*:\s*(?:\\"|")([^"\\]+)(?:\\"|")/);
  return {
    token: tokenMatch?.[1] || '',
    anonId: anonMatch?.[1] || '',
  };
}

function buildKeyFlowHeaders(cookieHeader: string, userAgent: string, refererPath: string): Headers {
  const headers = new Headers();
  headers.set('host', new URL(UPSTREAM_ORIGIN).host);
  headers.set('origin', UPSTREAM_ORIGIN);
  headers.set('referer', `${UPSTREAM_ORIGIN}${refererPath}`);
  headers.set('sec-fetch-site', 'same-origin');
  headers.set('user-agent', userAgent || DEFAULT_USER_AGENT);
  headers.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  headers.set('accept-encoding', 'gzip, deflate, br');
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  return headers;
}

async function performAutoKeyGenerateAndVerify(params: {
  batchId: string;
  keyGenPath?: string;
  cookieHeader: string;
  userAgent: string;
}): Promise<AutoVerifyResult> {
  const { batchId, cookieHeader, userAgent } = params;
  const keyGenPath =
    params.keyGenPath ||
    (batchId ? `/key-generate?batchId=${encodeURIComponent(batchId)}` : '/key-generate');

  const cookieMap = parseCookieMap(cookieHeader);
  const collectedSetCookies: string[] = [];

  // Step 1: Request /key-generate to get a fresh token (and anon_id if not yet issued)
  const kgRes = await fetch(`${UPSTREAM_ORIGIN}${keyGenPath}`, {
    method: 'GET',
    headers: buildKeyFlowHeaders(serializeCookieMap(cookieMap), userAgent, '/study/batches'),
    redirect: 'manual',
  });

  const kgSetCookies =
    typeof kgRes.headers.getSetCookie === 'function' ? kgRes.headers.getSetCookie() : [];
  if (kgSetCookies.length > 0) {
    collectedSetCookies.push(...kgSetCookies);
    mergeSetCookiesIntoMap(kgSetCookies, cookieMap);
  }

  // If upstream already considers this session+batch verified, it returns 307 directly
  if (kgRes.status >= 300 && kgRes.status < 400) {
    const loc = cleanVerifiedRedirectUrl(kgRes.headers.get('location'), batchId);
    const updatedCookieHeader = serializeCookieMap(cookieMap);
    const sessionKey = getSessionIdentityKey(cookieMap);
    if (batchId) {
      const now = Date.now();
      verifiedKeyRegistry.set(`${sessionKey}:${batchId}`, {
        sessionKey,
        batchId,
        cookieHeader: updatedCookieHeader,
        userAgent,
        verifiedAt: now,
        expiresAt: now + KEY_VALIDITY_MS,
        lastSeenAt: now,
      });
    }
    return {
      ok: true,
      redirectTo: loc,
      setCookies: collectedSetCookies,
      updatedCookieHeader,
    };
  }

  const kgBody = await kgRes.text();
  const { token, anonId } = extractKeyGenTokenAndAnonId(kgBody);

  if (anonId && !cookieMap.has('anon_id')) {
    cookieMap.set('anon_id', anonId);
    collectedSetCookies.push(`anon_id=${anonId}; Path=/; Max-Age=2592000`);
  }

  if (!token) {
    return {
      ok: false,
      redirectTo: batchId ? `/study/batches/${encodeURIComponent(batchId)}` : '/study/batches',
      setCookies: collectedSetCookies,
      updatedCookieHeader: serializeCookieMap(cookieMap),
    };
  }

  // Step 2: Automatically verify the generated token via /verify?token=...
  const verifyRes = await fetch(
    `${UPSTREAM_ORIGIN}/verify?token=${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: buildKeyFlowHeaders(serializeCookieMap(cookieMap), userAgent, keyGenPath),
      redirect: 'manual',
    }
  );

  const verifySetCookies =
    typeof verifyRes.headers.getSetCookie === 'function' ? verifyRes.headers.getSetCookie() : [];
  if (verifySetCookies.length > 0) {
    collectedSetCookies.push(...verifySetCookies);
    mergeSetCookiesIntoMap(verifySetCookies, cookieMap);
  }

  const verifyOk = verifyRes.status >= 200 && verifyRes.status < 400;
  const redirectTo = cleanVerifiedRedirectUrl(verifyRes.headers.get('location'), batchId);
  const updatedCookieHeader = serializeCookieMap(cookieMap);
  const sessionKey = getSessionIdentityKey(cookieMap);

  if (verifyOk && batchId) {
    const now = Date.now();
    verifiedKeyRegistry.set(`${sessionKey}:${batchId}`, {
      sessionKey,
      batchId,
      cookieHeader: updatedCookieHeader,
      userAgent,
      verifiedAt: now,
      expiresAt: now + KEY_VALIDITY_MS,
      lastSeenAt: now,
    });
  }

  return {
    ok: verifyOk,
    redirectTo,
    setCookies: collectedSetCookies,
    updatedCookieHeader,
  };
}

async function autoGenerateAndVerifyKey(params: {
  batchId: string;
  keyGenPath?: string;
  cookieHeader: string;
  userAgent: string;
}): Promise<AutoVerifyResult> {
  const cookieMap = parseCookieMap(params.cookieHeader);
  const sessionKey = getSessionIdentityKey(cookieMap);
  const lockKey = `${sessionKey}:${params.batchId || params.keyGenPath || 'default'}`;

  const existingPromise = inFlightAutoVerifications.get(lockKey);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = performAutoKeyGenerateAndVerify(params).finally(() => {
    inFlightAutoVerifications.delete(lockKey);
  });
  inFlightAutoVerifications.set(lockKey, promise);
  return promise;
}

function startKeyRenewalScheduler(): void {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of verifiedKeyRegistry.entries()) {
      if (now - entry.lastSeenAt > KEY_ENTRY_MAX_IDLE_MS) {
        verifiedKeyRegistry.delete(key);
        continue;
      }
      if (now >= entry.expiresAt - KEY_RENEW_BEFORE_EXPIRY_MS) {
        void autoGenerateAndVerifyKey({
          batchId: entry.batchId,
          cookieHeader: entry.cookieHeader,
          userAgent: entry.userAgent,
        }).catch((err) => {
          console.warn(`Auto key renewal failed for batch ${entry.batchId}:`, err);
        });
      }
    }
  }, KEY_SCHEDULER_INTERVAL_MS);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function applySetCookiesToResponse(
  res: Response,
  setCookies: string[],
  isHttps: boolean
): void {
  const safeCookies = filterSensitiveSetCookiesForBrowser(setCookies);
  if (safeCookies.length === 0) return;
  const existing = res.getHeader('Set-Cookie');
  const existingArr = Array.isArray(existing)
    ? existing.map(String)
    : existing
      ? [String(existing)]
      : [];
  const adapted = safeCookies.map((cookie) => rewriteSetCookie(cookie, isHttps));
  res.setHeader('Set-Cookie', [...existingArr, ...adapted]);
}

function copyUpstreamHeadersToResponse(
  upstreamRes: globalThis.Response,
  res: Response,
  isHttps: boolean
): void {
  upstreamRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (STRIPPED_RESPONSE_HEADERS.has(lower)) {
      return;
    }
    if (lower === 'location') {
      const rewrittenLocation = value.startsWith(UPSTREAM_ORIGIN)
        ? value.slice(UPSTREAM_ORIGIN.length) || '/'
        : value;
      res.setHeader('Location', rewrittenLocation);
      return;
    }
    res.setHeader(key, value);
  });

  const setCookies =
    typeof upstreamRes.headers.getSetCookie === 'function'
      ? upstreamRes.headers.getSetCookie()
      : [];
  captureSharedTokensFromSetCookies(setCookies);
  applySetCookiesToResponse(res, setCookies, isHttps);
}

async function handleCustomIcon(_req: Request, res: Response) {
  const icon = await getCustomIcon();
  if (!icon) {
    res.redirect(302, CUSTOM_ICON_DIRECT_URL);
    return;
  }
  res.setHeader('Content-Type', icon.contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(icon.buffer);
}

async function startServer() {
  await loadSharedSessionFromDisk();
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Serve the custom GB STUDY icon cleanly across icon routes and Next.js image optimizer
  app.get([LOCAL_ICON_PATH, '/icon-192x192.png', '/favicon.ico'], handleCustomIcon);
  app.get('/_next/image', (req, res, next) => {
    const imageUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (
      imageUrl.includes('gb-study-icon') ||
      imageUrl.includes('studypanda.live/icon-192x192.png') ||
      imageUrl.includes('ibb.co/')
    ) {
      void handleCustomIcon(req, res);
      return;
    }
    next();
  });

  // Serve local public assets (SVG icons, placeholders)
  app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));

  // Redirect top-level page navigations cleanly using shared permanent login
  app.use((req, res, next) => {
    captureSharedTokensFromCookieHeader(req.headers.cookie);

    if (
      req.method === 'GET' &&
      isSpaUiRoute(req.path) &&
      !req.headers.rsc &&
      !req.query._rsc
    ) {
      const authed = hasSharedSession() || hasSessionCookie(req.headers.cookie);
      if (!authed && req.path !== '/auth' && req.path !== '/contact') {
        res.redirect(307, '/auth');
        return;
      }
      if (authed && (req.path === '/' || req.path === '/auth')) {
        res.redirect(307, '/study/batches');
        return;
      }
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (!isSpaUiRoute(req.path) || req.headers.rsc || req.query._rsc) {
        next();
        return;
      }
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        let template = await fs.readFile(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(template);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use('/assets', express.static(path.join(distDir, 'assets')));
    app.get('*', (req, res, next) => {
      if (!isSpaUiRoute(req.path) || req.headers.rsc || req.query._rsc) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Parse raw body for upstream proxy routes so JSON, form data, and binary payloads forward intact
  app.use(express.raw({ type: '*/*', limit: '50mb' }));

  app.use(async (req: Request, res: Response) => {
    try {
      const targetUrl = new URL(req.originalUrl, UPSTREAM_ORIGIN);
      // Strict host validation to prevent open-proxy / SSRF (e.g. //evil.com)
      if (targetUrl.origin !== UPSTREAM_ORIGIN) {
        res.status(400).send('Invalid request path');
        return;
      }

      const isHttps =
        req.secure ||
        String(req.headers['x-forwarded-proto'] || '').includes('https') ||
        (typeof req.headers.host === 'string' && req.headers.host.startsWith('localhost'));

      captureSharedTokensFromCookieHeader(req.headers.cookie);

      // Protect shared permanent session from accidental logout by any visitor
      if (req.method === 'POST' && targetUrl.pathname === '/api/logout' && hasSharedSession()) {
        res.status(200).json({ success: true, message: 'Shared session active' });
        return;
      }

      const upstreamHeaders = buildUpstreamHeaders(req, targetUrl.pathname + targetUrl.search);
      const activeUserAgent = upstreamHeaders.get('user-agent') || DEFAULT_USER_AGENT;
      const mergedCookieHeader = applySharedSessionToCookieHeader(
        upstreamHeaders.get('cookie') || ''
      );
      if (mergedCookieHeader) {
        upstreamHeaders.set('cookie', mergedCookieHeader);
      }
      const rawCookieHeader = mergedCookieHeader;

      // Direct hits to /key-generate are auto-generated and verified silently on the server
      if (req.method === 'GET' && targetUrl.pathname === '/key-generate') {
        const batchId = extractBatchIdFromRequest(targetUrl, req.headers.referer);
        if (!batchId) {
          res.redirect(307, '/study/batches');
          return;
        }
        const autoResult = await autoGenerateAndVerifyKey({
          batchId,
          keyGenPath: targetUrl.pathname + targetUrl.search,
          cookieHeader: rawCookieHeader,
          userAgent: activeUserAgent,
        });
        applySetCookiesToResponse(res, autoResult.setCookies, isHttps);
        res.redirect(307, autoResult.redirectTo);
        return;
      }

      // Proactively renew expired (or nearly expired) 24-hour keys for active batch requests
      const batchIdForRequest = extractBatchIdFromRequest(targetUrl, req.headers.referer);
      const extraSetCookies: string[] = [];
      if (batchIdForRequest) {
        const cookieMap = parseCookieMap(rawCookieHeader);
        const sessionKey = getSessionIdentityKey(cookieMap);
        const registryKey = `${sessionKey}:${batchIdForRequest}`;
        const existingEntry = verifiedKeyRegistry.get(registryKey);
        if (existingEntry) {
          existingEntry.lastSeenAt = Date.now();
          if (rawCookieHeader) {
            existingEntry.cookieHeader = rawCookieHeader;
          }
          if (Date.now() >= existingEntry.expiresAt - KEY_RENEW_BEFORE_EXPIRY_MS) {
            const renewed = await autoGenerateAndVerifyKey({
              batchId: batchIdForRequest,
              cookieHeader: rawCookieHeader || existingEntry.cookieHeader,
              userAgent: activeUserAgent,
            });
            if (renewed.updatedCookieHeader) {
              upstreamHeaders.set('cookie', renewed.updatedCookieHeader);
            }
            if (renewed.setCookies.length > 0) {
              extraSetCookies.push(...renewed.setCookies);
            }
          }
        }
      }

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const bodyBuffer =
        hasBody && Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;

      let upstreamRes = await fetch(targetUrl.toString(), {
        method: req.method,
        headers: upstreamHeaders,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
        redirect: 'manual',
      });

      // Intercept header-level redirects to /key-generate, auto-verify, and transparently retry
      const headerKeyGenRedirect = detectKeyGenerateRedirect(upstreamRes);
      if (headerKeyGenRedirect) {
        const kgUrl = new URL(headerKeyGenRedirect, UPSTREAM_ORIGIN);
        const redirectBatchId =
          extractBatchIdFromRequest(kgUrl, req.headers.referer) || batchIdForRequest;
        const autoResult = await autoGenerateAndVerifyKey({
          batchId: redirectBatchId,
          keyGenPath: kgUrl.pathname + kgUrl.search,
          cookieHeader: upstreamHeaders.get('cookie') || rawCookieHeader,
          userAgent: activeUserAgent,
        });
        if (autoResult.setCookies.length > 0) {
          extraSetCookies.push(...autoResult.setCookies);
        }
        if (autoResult.updatedCookieHeader) {
          upstreamHeaders.set('cookie', autoResult.updatedCookieHeader);
        }
        if (autoResult.ok) {
          upstreamRes = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: upstreamHeaders,
            body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
            redirect: 'manual',
          });
        }
      }

      const contentType = upstreamRes.headers.get('content-type') || '';
      const { isJson, isHtmlOrRsc, isJsChunk } = isTextRewritableContentType(contentType);

      // Intercept HTML/RSC body-level NEXT_REDIRECT to /key-generate before sending response
      let bufferedTextBody: string | null = null;
      if (req.method !== 'HEAD' && upstreamRes.body && isHtmlOrRsc) {
        bufferedTextBody = await upstreamRes.text();
        const bodyKeyGenRedirect = detectKeyGenerateRedirect(upstreamRes, bufferedTextBody);
        if (bodyKeyGenRedirect) {
          const kgUrl = new URL(bodyKeyGenRedirect, UPSTREAM_ORIGIN);
          const redirectBatchId =
            extractBatchIdFromRequest(kgUrl, req.headers.referer) || batchIdForRequest;
          const autoResult = await autoGenerateAndVerifyKey({
            batchId: redirectBatchId,
            keyGenPath: kgUrl.pathname + kgUrl.search,
            cookieHeader: upstreamHeaders.get('cookie') || rawCookieHeader,
            userAgent: activeUserAgent,
          });
          if (autoResult.setCookies.length > 0) {
            extraSetCookies.push(...autoResult.setCookies);
          }
          if (autoResult.updatedCookieHeader) {
            upstreamHeaders.set('cookie', autoResult.updatedCookieHeader);
          }
          if (autoResult.ok) {
            upstreamRes = await fetch(targetUrl.toString(), {
              method: req.method,
              headers: upstreamHeaders,
              body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
              redirect: 'manual',
            });
            bufferedTextBody = upstreamRes.body ? await upstreamRes.text() : '';
          }
        }
      }

      // Silently refresh shared accessToken if upstream returns 401 and refreshToken is available
      if (upstreamRes.status === 401 && hasSharedSession() && sharedSession.refreshToken) {
        const refreshRes = await fetch(`${UPSTREAM_ORIGIN}/study/batches`, {
          method: 'GET',
          headers: buildKeyFlowHeaders(
            `refreshToken=${sharedSession.refreshToken}`,
            activeUserAgent,
            '/study/batches'
          ),
          redirect: 'manual',
        });
        const refreshSetCookies =
          typeof refreshRes.headers.getSetCookie === 'function'
            ? refreshRes.headers.getSetCookie()
            : [];
        if (refreshSetCookies.length > 0) {
          captureSharedTokensFromSetCookies(refreshSetCookies);
          const refreshedCookies = applySharedSessionToCookieHeader(
            upstreamHeaders.get('cookie') || rawCookieHeader
          );
          if (refreshedCookies) {
            upstreamHeaders.set('cookie', refreshedCookies);
          }
          upstreamRes = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: upstreamHeaders,
            body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
            redirect: 'manual',
          });
          bufferedTextBody = null;
        }
      }

      copyUpstreamHeadersToResponse(upstreamRes, res, isHttps);
      applySetCookiesToResponse(res, extraSetCookies, isHttps);

      res.status(upstreamRes.status);

      if (req.method === 'HEAD' || !upstreamRes.body) {
        res.end();
        return;
      }

      if (isJson) {
        const rawText = await upstreamRes.text();
        try {
          const parsed = JSON.parse(rawText);
          const rewritten = rewriteJsonValue(parsed, targetUrl.pathname);
          res.send(JSON.stringify(rewritten));
        } catch {
          res.send(rewriteBrandContent(rawText));
        }
        return;
      }

      if (isHtmlOrRsc) {
        const rawText = bufferedTextBody ?? (await upstreamRes.text());
        res.send(rewriteBrandContent(rawText));
        return;
      }

      if (isJsChunk && targetUrl.pathname.includes('6283-')) {
        const rawJs = await upstreamRes.text();
        res.send(rewriteJsChunk(rawJs));
        return;
      }

      // Stream binary/media/CSS/JS/PDF/video chunks directly without buffering
      const upstreamEncoding = upstreamRes.headers.get('content-encoding');
      const contentLength = upstreamRes.headers.get('content-length');
      if (contentLength && !upstreamEncoding) {
        res.setHeader('Content-Length', contentLength);
      }

      const nodeStream = Readable.fromWeb(upstreamRes.body as unknown as WebReadableStream);
      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });
      nodeStream.pipe(res);
    } catch (error) {
      console.error('Proxy error:', error);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Upstream proxy error' });
      } else {
        res.end();
      }
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GB STUDY server listening on http://0.0.0.0:${PORT}`);
    // Warm up icon cache and start 24-hour automatic key renewal scheduler
    void getCustomIcon();
    startKeyRenewalScheduler();
  });
}

void startServer();
