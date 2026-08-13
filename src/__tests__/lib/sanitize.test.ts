import { describe, it, expect } from 'vitest';

import { sanitizeHtml } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('keeps allowed basic formatting tags', () => {
    const input = '<p>Hello <strong>world</strong><br><em>nice</em></p>';

    expect(sanitizeHtml(input)).toBe('<p>Hello <strong>world</strong><br><em>nice</em></p>');
  });

  it('removes disallowed tags like script and image', () => {
    const input = '<p>Hi</p><script>alert(1)</script><img src="x" onerror="alert(2)">';
    const result = sanitizeHtml(input);

    expect(result).toContain('<p>Hi</p>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });

  it('strips attributes from allowed tags', () => {
    const input =
      '<p class="foo" data-test="x" aria-label="greeting">Hello</p><strong id="bar">World</strong>';

    expect(sanitizeHtml(input)).toBe('<p>Hello</p><strong>World</strong>');
  });

  it('preserves plain text content', () => {
    expect(sanitizeHtml('Just plain text')).toBe('Just plain text');
  });
});
