import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageMarkdown } from '../src/components/MessageMarkdown.js';

test('inline code stays inline while fenced code has one valid pre and a copy control', () => {
  const html = renderToStaticMarkup(createElement(MessageMarkdown, {content: 'Use `map()` here.\n\n```c++\nint main() { return 0; }\n```'}));
  assert.match(html, /<p>Use <code>map\(\)<\/code> here\.<\/p>/);
  assert.equal((html.match(/<pre\b/g) || []).length, 1);
  assert.match(html, /c\+\+/); assert.match(html, /Copy code to clipboard/);
  assert.doesNotMatch(html, /<pre[^>]*><div/);
});
test('formatted answers preserve semantic lists, a scrollable table, and safe links', () => {
  const html = renderToStaticMarkup(createElement(MessageMarkdown, {content: '## Steps\n\n1. Read\n2. Write\n\n| Mode | Use |\n| --- | --- |\n| Fast | Notes |\n\n[Source](https://example.com)\n\n<script>alert(1)</script>'}));
  assert.match(html, /<h2>Steps<\/h2>/); assert.match(html, /<ol>/);
  assert.match(html, /role="region" aria-label="Response table" tabindex="0"><table>/);
  assert.match(html, /rel="noopener noreferrer"/); assert.doesNotMatch(html, /<script>/);
});
