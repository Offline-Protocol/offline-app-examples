import { DataStore } from '@offline-app-examples/mesh';
import { useCallback, useEffect, useRef, useState } from 'react';
import { charCount, diffText, shiftCaret, type Edit } from './domain/text';

// Where everything lives in the room's space (the MLS group id):
//   doc "doc"      → text collection "body" (the document) + map "meta" { title }
//   doc "presence" → map "cursors" { [deviceId]: JSON {name, pos, t} }
// Presence is its own document so cursor churn never touches the text's document.
const DOC = 'doc';
const BODY = 'body';
const META = 'meta';
const PRESENCE = 'presence';
const CURSORS = 'cursors';

// Every flush is one encrypted group frame over BLE. An Android phone sends to an iPhone at
// only ~2 KB/s (185-byte indications), so batch keystrokes instead of flushing each one.
const FLUSH_MS = 500; // at most 2 text frames a second while typing
const CURSOR_MS = 1000; // at most 1 cursor write a second
const HEARTBEAT_MS = 10_000; // rewrite our cursor now and then so others know we are still here
const STALE_MS = 30_000; // hide a cursor that has not changed for this long

export type Collaborator = { id: string; name: string; pos: number };
type Selection = { start: number; end: number };

/**
 * The shared document, wired to the SDK's DataStore. `changes` counts `data_changed`
 * events per document id (the room's onProtocolEvent bumps it), which triggers a re-read.
 */
export function useSharedDoc(
  space: string,
  me: { id: string; name: string },
  changes: Record<string, number>,
) {
  const [store] = useState(() => new DataStore()); // created once the room is running
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [others, setOthers] = useState<Collaborator[]>([]);
  // Set when a remote edit moved our caret; the editor applies it to the TextInput.
  const [caretFix, setCaretFix] = useState<Selection | null>(null);

  const textRef = useRef(''); // what the input shows right now
  const selection = useRef<Selection>({ start: 0, end: 0 });
  const typed = useRef(0); // bumps on every local keystroke
  const applied = useRef(0); // the last keystroke whose write reached the store
  const seen = useRef(new Map<string, { raw: string; at: number }>()); // presence values and when they last changed

  // Every DataStore call goes through one queue, so reads never interleave with writes.
  const queue = useRef(Promise.resolve());
  const run = useCallback((task: () => Promise<void>) => {
    queue.current = queue.current
      .then(task)
      .catch((error) => console.warn('[cowrite]', error));
  }, []);

  // Edits stay on this phone until flushed; a flush makes them durable and pushes them to the group.
  // Throttled, not debounced: while typing, one flush every FLUSH_MS carries everything since the last.
  const flushTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flushSoon = useCallback(
    (doc: string) => {
      if (flushTimers.current[doc]) return; // a flush is already coming
      flushTimers.current[doc] = setTimeout(() => {
        delete flushTimers.current[doc];
        run(() => store.flush(space, doc));
      }, FLUSH_MS);
    },
    [run, space, store],
  );

  // ---------------------------------------------------------------- the text

  /** Re-read the text after a remote change and keep our caret on the same spot. */
  const readText = useCallback(() => {
    run(async () => {
      const [remote, savedTitle] = await Promise.all([
        store.textValue(space, DOC, BODY),
        store.mapGet(space, DOC, META, 'title'),
      ]);
      // A keystroke still queued behind us isn't in `remote` yet: showing `remote` would
      // briefly undo it and strand the caret. Its flush brings another data_changed, so skip.
      if (applied.current !== typed.current) return;
      if (savedTitle?.kind === 'text') setTitle(savedTitle.value);
      if (remote === textRef.current) return;
      const edit = diffText(textRef.current, remote)!;
      const { start, end } = selection.current;
      selection.current = {
        start: shiftCaret(start, edit),
        end: shiftCaret(end, edit),
      };
      textRef.current = remote;
      setText(remote);
      setOthers((list) =>
        list.map((o) => ({ ...o, pos: shiftCaret(o.pos, edit) })),
      );
      setCaretFix(selection.current);
    });
  }, [run, space, store]);

  /** The input changed: turn it into one delete + insert on the shared text. */
  const onChangeText = (next: string) => {
    const prev = textRef.current;
    const edit = diffText(prev, next);
    textRef.current = next;
    setText(next);
    if (!edit) return;
    const seq = ++typed.current;
    setOthers((list) =>
      list.map((o) => ({ ...o, pos: shiftCaret(o.pos, edit) })),
    );
    run(async () => {
      try {
        // A remote change may have merged in since `prev` was on screen. Move our edit
        // through it so it still lands between the same characters.
        const stored = await store.textValue(space, DOC, BODY);
        const { index, removed } =
          stored === prev ? edit : rebase(edit, diffText(prev, stored)!);
        // The SDK counts characters, JavaScript counts UTF-16 units (emoji are 2).
        const at = charCount(stored.slice(0, index));
        const count = charCount(stored.slice(index, index + removed));
        if (count) await store.textDelete(space, DOC, BODY, at, count);
        if (edit.inserted)
          await store.textInsert(space, DOC, BODY, at, edit.inserted);
      } finally {
        applied.current = seq;
      }
      flushSoon(DOC);
    });
  };

  /** The title is one map key: whoever renamed the document last wins. */
  const onTitleChange = (next: string) => {
    setTitle(next);
    const seq = ++typed.current;
    run(async () => {
      try {
        await store.mapSet(space, DOC, META, 'title', {
          kind: 'text',
          value: next,
        });
      } finally {
        applied.current = seq;
      }
      flushSoon(DOC);
    });
  };

  // ------------------------------------------------------------ presence

  const lastCursorWrite = useRef(0);
  const cursorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const writeCursor = useCallback(() => {
    clearTimeout(cursorTimer.current);
    const wait = lastCursorWrite.current + CURSOR_MS - Date.now();
    if (wait > 0) {
      cursorTimer.current = setTimeout(writeCursor, wait); // trailing write, so the last move always lands
      return;
    }
    lastCursorWrite.current = Date.now();
    const value = JSON.stringify({
      name: me.name,
      pos: selection.current.end,
      t: Date.now(),
    });
    run(async () => {
      await store.mapSet(space, PRESENCE, CURSORS, me.id, {
        kind: 'text',
        value,
      });
      flushSoon(PRESENCE);
    });
  }, [flushSoon, me.id, me.name, run, space, store]);

  const onSelectionChange = (next: Selection) => {
    selection.current = next;
    setCaretFix(null);
    writeCursor();
  };

  /** Re-read everyone's cursor. Last writer wins per key, so each key is that person's latest. */
  const readPresence = useCallback(() => {
    run(async () => {
      const json = (await store.docJson(space, PRESENCE)) as {
        [CURSORS]?: Record<string, unknown>;
      };
      const now = Date.now();
      const list: Collaborator[] = [];
      for (const [id, raw] of Object.entries(json?.[CURSORS] ?? {})) {
        if (typeof raw !== 'string' || id === me.id) continue;
        const cursor = parseCursor(raw);
        if (!cursor) continue;
        // Phones' clocks differ, so staleness is judged by when *we* saw the value change.
        const prev = seen.current.get(id);
        if (prev?.raw !== raw) seen.current.set(id, { raw, at: now });
        if (now - seen.current.get(id)!.at < STALE_MS)
          list.push({ id, ...cursor });
      }
      setOthers(list);
    });
  }, [me.id, run, space, store]);

  /** Take our cursor out of the document before leaving the room. */
  const goodbye = async () => {
    run(async () => {
      await store.mapDelete(space, PRESENCE, CURSORS, me.id);
      await Promise.all([
        store.flush(space, PRESENCE),
        store.flush(space, DOC),
      ]);
    });
    await queue.current;
  };

  // Re-read whenever the SDK reports a durable change (ours or a peer's).
  const docChanges = changes[DOC];
  const presenceChanges = changes[PRESENCE];
  useEffect(readText, [readText, docChanges]);
  useEffect(readPresence, [readPresence, presenceChanges]);

  // Heartbeat our cursor, and re-check for stale ones.
  useEffect(() => {
    writeCursor();
    const timer = setInterval(() => {
      writeCursor();
      readPresence();
    }, HEARTBEAT_MS);
    const timers = flushTimers.current;
    return () => {
      clearInterval(timer);
      clearTimeout(cursorTimer.current);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [readPresence, writeCursor]);

  return {
    text,
    title,
    onTitleChange,
    others,
    caretFix,
    onChangeText,
    onSelectionChange,
    goodbye,
  };
}

/** Move a local edit (made against the old text) through a remote edit that merged in since. */
function rebase(local: Edit, remote: Edit): Edit {
  const start = shiftCaret(local.index, remote);
  const end = shiftCaret(local.index + local.removed, remote);
  return {
    index: start,
    removed: Math.max(0, end - start),
    inserted: local.inserted,
  };
}

/** Presence values come from other phones: check the shape before trusting them. */
function parseCursor(raw: string): { name: string; pos: number } | null {
  try {
    const value = JSON.parse(raw);
    if (
      typeof value?.name !== 'string' ||
      !Number.isInteger(value.pos) ||
      value.pos < 0
    )
      return null;
    return { name: value.name.slice(0, 40) || 'Someone', pos: value.pos };
  } catch {
    return null;
  }
}
