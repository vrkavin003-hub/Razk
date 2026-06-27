const TRAILING_URL_PUNCTUATION = /[.,!?;:)}\]]+$/;

export const announcementMessageParts = (message = "") => {
  const text = String(message ?? "");
  const parts = [];
  let cursor = 0;

  for (const match of text.matchAll(/https?:\/\/[^\s]+/gi)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, start) });
    }

    const rawUrl = match[0];
    const trailing = rawUrl.match(TRAILING_URL_PUNCTUATION)?.[0] || "";
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
    parts.push({ type: "link", value: url });
    if (trailing) parts.push({ type: "text", value: trailing });
    cursor = start + rawUrl.length;
  }

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }

  return parts.length ? parts : [{ type: "text", value: text }];
};
