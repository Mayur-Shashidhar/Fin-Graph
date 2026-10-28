import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'fingraph_session';
export function sameOrigin(request: Request) {
  try {
    const incoming = new URL(request.url);
    const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : `${incoming.protocol}//${request.headers.get('host') ?? incoming.host}`;
    return request.headers.get('origin') === expected;
  } catch { return false; }
}
const SESSION_SECONDS = 8 * 60 * 60;
export function configuredKey() { const key = process.env.GRAPH_API_TOKEN; return key && key.length >= 32 ? key : null; }
export function matchesKey(provided: string) {
  const key = configuredKey();
  if (!key) return false;
  const a = Buffer.from(key), b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createSession(name: string) {
  const key = configuredKey();
  if (!key) throw new Error('Investigator access is not configured');
  const body = Buffer.from(JSON.stringify({ name, expires: Date.now() + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}
export function readSession(value: string | undefined): { name: string } | null {
  const key = configuredKey();
  if (!key || !value || value.length > 2048) return null;
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra) return null;
  const expected = createHmac('sha256', key).update(body).digest('base64url');
  const suppliedBytes = Buffer.from(signature), expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof data.name === 'string' && data.name.length <= 80 && Number.isFinite(data.expires) && data.expires > Date.now() ? { name: data.name } : null;
  } catch { return null; }
}
export function requestSession(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return readSession(value);
}
export function authorizeRequest(request: Request): Response | null {
  if (!configuredKey()) return Response.json({ error: 'Investigator access is not configured. Run npm run demo or set GRAPH_API_TOKEN.' }, { status: 503 });
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ') && matchesKey(authorization.slice(7))) return null;
  if (!requestSession(request)) return Response.json({ error: 'Please sign in to continue.' }, { status: 401 });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !sameOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  return null;
}
export function sessionCookie(request: Request, value: string, expire = false) {
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${expire ? 0 : SESSION_SECONDS}${new URL(process.env.APP_URL ?? request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
