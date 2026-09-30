// Pure text helpers for the editor. No SDK or React imports, so they are easy to test.
// Offsets here are JavaScript string offsets (UTF-16 units), the same units TextInput
// selections use. The SDK counts characters (code points); convert with `charCount`.

/** One contiguous change: at `index`, `removed` units were replaced by `inserted`. */
export type Edit = { index: number; removed: number; inserted: string };

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * The single edit that turns `prev` into `next`: skip the common prefix and suffix,
 * whatever is left in between was replaced. Typing, deleting, pasting and autocorrect
 * each produce one such edit. Never splits an emoji (surrogate pair) in half.
 */
export function diffText(prev: string, next: string): Edit | null {
  if (prev === next) return null;
  const max = Math.min(prev.length, next.length);
  let start = 0;
  while (start < max && prev[start] === next[start]) start++;
  if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) start--;
  let end = 0;
  while (
    end < max - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  if (end > 0 && isLowSurrogate(prev.charCodeAt(prev.length - end))) end--;
  return {
    index: start,
    removed: prev.length - start - end,
    inserted: next.slice(start, next.length - end),
  };
}

/**
 * Where a caret (or any position) ends up after someone else's edit. Edits after the
 * caret leave it alone, edits before it push it along, and if the text around the
 * caret was replaced it lands just after the replacement.
 */
export function shiftCaret(pos: number, edit: Edit): number {
  if (pos <= edit.index) return pos;
  if (pos >= edit.index + edit.removed)
    return pos - edit.removed + edit.inserted.length;
  return edit.index + edit.inserted.length;
}

/** Characters (code points) in a string: the unit the SDK's text offsets use. */
export const charCount = (text: string) => Array.from(text).length;

export const wordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/** A run of the document, optionally tinted to show someone's cursor. */
export type Segment = { text: string; color?: string };

/**
 * Splits the text into runs so each remote cursor tints the one character right after
 * it (or right before it at the end of a line). The characters are never changed, so
 * the runs always join back into exactly `text`.
 */
export function markCursors(
  text: string,
  cursors: { pos: number; color: string }[],
): Segment[] {
  const marks: { start: number; end: number; color: string }[] = [];
  for (const { pos, color } of cursors) {
    let at = Math.min(Math.max(pos, 0), text.length);
    if (at === text.length || text[at] === '\n') at--; // nothing visible after it: tint the previous character
    if (at < 0 || text[at] === '\n') continue; // empty line: the presence bar still shows them
    if (isLowSurrogate(text.charCodeAt(at))) at--;
    const end = isHighSurrogate(text.charCodeAt(at)) ? at + 2 : at + 1;
    marks.push({ start: at, end, color });
  }
  marks.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let from = 0;
  for (const mark of marks) {
    if (mark.start < from) continue; // two cursors on one character: the first one shows
    if (mark.start > from)
      segments.push({ text: text.slice(from, mark.start) });
    segments.push({
      text: text.slice(mark.start, mark.end),
      color: mark.color,
    });
    from = mark.end;
  }
  if (from < text.length) segments.push({ text: text.slice(from) });
  return segments;
}
