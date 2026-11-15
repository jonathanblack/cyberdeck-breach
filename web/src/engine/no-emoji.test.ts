// Shipped sources carry no emoji (CLAUDE.md conventions), including plain symbols with the Emoji property such as the card suits.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(ts|css|html)$/.test(f) ? [p] : [];
});

it('no emoji in shipped sources', () => {
  const root = join(__dirname, '..', '..');
  const hits: string[] = [];
  for (const f of [...files(join(root, 'src')), join(root, 'index.html')]) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu)) hits.push(`${f}: U+${m[0].codePointAt(0)!.toString(16)}`);
  }
  expect(hits).toEqual([]);
});
