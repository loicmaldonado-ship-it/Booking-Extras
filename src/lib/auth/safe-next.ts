/** Only accept internal paths after team login. Client-provided `next` is untrusted. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  // Backslashes and encoded separators may be interpreted as host separators
  // by URL parsers. Prevent control-character header injection as well.
  if (/[\\\x00-\x1f\x7f]/.test(value) || /%(?:2f|5c|0d|0a)/i.test(value)) return "/";
  try {
    const url = new URL(value, "https://internal.booking.invalid");
    if (url.origin !== "https://internal.booking.invalid" || url.pathname.startsWith("//")) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
