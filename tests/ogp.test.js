import { it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const meta = (attr, name) => (html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)) || [])[1];
const URL_ = 'https://nagashinocat.github.io/chounouryokusha-no-shoumei/';

it('link previews show the image on LINE, X, iMessage and Facebook', () => {
  expect(meta('property', 'og:title')).toBe('超能力者の証明');
  expect(meta('property', 'og:type')).toBe('website');
  expect(meta('property', 'og:url')).toBe(URL_);
  expect(meta('property', 'og:image')).toBe(URL_ + 'og.png');
  expect(meta('property', 'og:image:width')).toBe('1200');
  expect(meta('property', 'og:image:height')).toBe('630');
  expect(meta('property', 'og:image:alt')).toBeTruthy();
  expect(meta('property', 'og:site_name')).toBe('超能力者の証明');
  expect(meta('property', 'og:locale')).toBe('ja_JP');
  expect(meta('property', 'og:description')).toBeTruthy();
  expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  expect(meta('name', 'twitter:title')).toBe('超能力者の証明');
  expect(meta('name', 'twitter:image')).toBe(URL_ + 'og.png');
  expect(statSync('og.png').size).toBeLessThan(1_000_000);
});
