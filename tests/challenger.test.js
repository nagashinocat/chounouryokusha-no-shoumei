import { it, expect } from 'vitest';
import { makeChallenger, gameOverText, SURNAMES, MALE, FEMALE, JOBS } from '../src/challenger.js';

it('builds a label in the fixed format', () => {
  const pick = () => 0; // first of each list; gender index 0 = m; age 18
  const c = makeChallenger(42, pick);
  expect(c.label).toBe(`挑戦者 No.0042 ${SURNAMES[0]} ${MALE[0]}(18) ${JOBS[0]}`);
  expect(makeChallenger(7, pick).label.startsWith('挑戦者 No.0007 ')).toBe(true);
});
it('female challenger uses female names', () => {
  const seq = [0, 1, 0, 0, 57]; let i = 0;
  const c = makeChallenger(1, () => seq[i++]);
  expect(c.gender).toBe('f');
  expect(FEMALE).toContain(c.name.split(' ')[1]);
  expect(c.age).toBe(75);
});
it('lists are big enough', () => {
  expect(SURNAMES.length).toBeGreaterThanOrEqual(30);
  expect(MALE.length).toBeGreaterThanOrEqual(20);
  expect(FEMALE.length).toBeGreaterThanOrEqual(20);
  expect(JOBS.length).toBeGreaterThanOrEqual(20);
});
it('game over text', () => {
  expect(gameOverText('m')).toBe('その後、人口が1人減ったが誰も気づかなかった。');
  expect(gameOverText('f')).toBe('その後、人口が1人減ったが誰も気づかなかった。');
});
