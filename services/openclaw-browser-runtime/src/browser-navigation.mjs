const MAX_URL_CHARS = 2_048;

export function normaliseBoundedBrowserUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > MAX_URL_CHARS) {
    throw new Error("Browser navigation requires a URL within 2048 characters.");
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Browser navigation requires a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Browser navigation only allows HTTP(S) URLs.");
  }
  if (url.username || url.password) {
    throw new Error("Browser navigation URL must not contain credentials.");
  }
  return url.href;
}
