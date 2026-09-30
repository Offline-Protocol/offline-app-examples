import { describe, expect, it } from '@jest/globals';
import { diffText, markCursors, shiftCaret } from '../src/domain/text';

describe('diffText', () => {
  it('finds a typed, deleted or replaced run', () => {
    expect(diffText('helo', 'hello')).toEqual({
      index: 3,
      removed: 0,
      inserted: 'l',
    });
    expect(diffText('hello world', 'hello')).toEqual({
      index: 5,
      removed: 6,
      inserted: '',
    });
    expect(diffText('teh cat', 'the cat')).toEqual({
      index: 1,
      removed: 2,
      inserted: 'he',
    });
    expect(diffText('same', 'same')).toBeNull();
  });

  it('never splits an emoji', () => {
    // 😀 and 😃 share their first UTF-16 unit.
    expect(diffText('a😀b', 'a😃b')).toEqual({
      index: 1,
      removed: 2,
      inserted: '😃',
    });
  });
});

describe('shiftCaret', () => {
  const edit = { index: 2, removed: 3, inserted: 'xy' };
  it('keeps carets before the edit, moves carets after it', () => {
    expect(shiftCaret(1, edit)).toBe(1);
    expect(shiftCaret(2, edit)).toBe(2);
    expect(shiftCaret(8, edit)).toBe(7);
  });
  it('puts a caret inside replaced text after the replacement', () => {
    expect(shiftCaret(3, edit)).toBe(4);
  });
  it('matches the text: diff, then shift, keeps the caret on the same word', () => {
    const before = 'I like tea';
    const after = 'Honestly, I like tea';
    const caret = before.indexOf('tea');
    expect(after.slice(shiftCaret(caret, diffText(before, after)!))).toBe(
      'tea',
    );
  });
});

describe('markCursors', () => {
  it('tints one character and keeps the text intact', () => {
    const segments = markCursors('ab\ncd', [{ pos: 2, color: 'red' }]);
    expect(segments.map((s) => s.text).join('')).toBe('ab\ncd');
    expect(segments).toContainEqual({ text: 'b', color: 'red' });
  });
});
