import { z } from 'zod';
import { authorizeRequest, configuredKey, createSession, matchesKey, requestSession, sessionCookie, sameOrigin } from '@/lib/auth';

const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (!configuredKey()) return Response.json({ error: 'Access is not configured. Start with npm run demo or configure GRAPH_API_TOKEN.' }, { status: 503 });
  const scope = new URL(request.url).host;
  const entry = attempts.get(scope);
  if (entry && entry.until > Date.now() && entry.count >= 10) return Response.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  try {
    const text = await request.text();
    if (text.length > 2048) return Response.json({ error: 'Invalid sign-in request.' }, { status: 400 });
    const body = z.object({ name: z.string().trim().min(1).max(80), key: z.string().min(1).max(512) }).strict().parse(JSON.parse(text));
    if (!matchesKey(body.key)) {
      attempts.set(scope, { count: entry && entry.until > Date.now() ? entry.count + 1 : 1, until: Date.now() + 60000 });
      return Response.json({ error: 'The access key is incorrect.' }, { status: 401 });
    }
    attempts.delete(scope);
    return Response.json({ name: body.name }, { headers: { 'Set-Cookie': sessionCookie(request, createSession(body.name)), 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Enter your name and access key.' }, { status: 400 }); }
}
export async function GET(request: Request) {
  const denied = authorizeRequest(request); if (denied) return denied;
  return Response.json({ name: requestSession(request)?.name ?? 'API operator', demo: process.env.FINGRAPH_DEMO === 'true' }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function DELETE(request: Request) {
  const denied = authorizeRequest(request); if (denied) return denied;
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(request, '', true) } });
}
