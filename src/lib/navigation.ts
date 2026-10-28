/** Resolve return URLs as the browser does before trusting them. */
export function safeReturnPath(value: string | null, origin: string): string {
  try {
    const target = new URL(value ?? '/', origin);
    return target.origin === new URL(origin).origin ? target.pathname + target.search + target.hash : '/';
  } catch { return '/'; }
}
