import { describe, it, expect } from 'vitest';
import { createGame, applyGuess, isFateRound } from '../src/rules.js';

describe('rules', () => {
  it('starts with 4 believers', () => {
    expect(createGame({ population: 100 })).toEqual({ believers: 4, streak: 0, maxStreak: 0, rounds: 0, population: 100, status: 'playing' });
  });
  it('hit multiplies by 4', () => {
    const g = applyGuess(createGame({ population: 1000 }), true);
    expect(g).toMatchObject({ believers: 16, streak: 1, maxStreak: 1, rounds: 1 });
  });
  it('miss keeps 3/4 floored and resets streak', () => {
    let g = applyGuess(createGame({ population: 1000 }), true);
    g = applyGuess(g, false);
    expect(g).toMatchObject({ believers: 12, streak: 0, maxStreak: 1, rounds: 2 });
    expect(applyGuess({ ...g, believers: 7 }, false).believers).toBe(5);
  });
  it('zero believers is game over', () => {
    const g = applyGuess({ ...createGame({ population: 100 }), believers: 1 }, false);
    expect(g).toMatchObject({ believers: 0, status: 'over' });
  });
  it('reaching population clears', () => {
    const g = applyGuess({ ...createGame({ population: 100 }), believers: 32 }, true);
    expect(g).toMatchObject({ believers: 128, status: 'cleared' });
  });
  it('fate round when a hit would clear', () => {
    const g = createGame({ population: 100 });
    expect(isFateRound({ ...g, believers: 25 })).toBe(true);
    expect(isFateRound({ ...g, believers: 24 })).toBe(false);
  });
  it('finished game does not change', () => {
    const g = { ...createGame({ population: 100 }), believers: 0, status: 'over' };
    expect(applyGuess(g, true)).toEqual(g);
  });
  it('population is fixed at creation', () => {
    const g = applyGuess(createGame({ population: 500 }), true);
    expect(g.population).toBe(500);
    expect(applyGuess.length).toBe(2);
  });
  it('16 straight hits clear 8.2 billion from 4 believers, 15 do not', () => {
    let g = createGame({ population: 8_200_000_000 });
    for (let i = 0; i < 15; i++) g = applyGuess(g, true);
    expect(g.status).toBe('playing');
    expect(isFateRound(g)).toBe(true);
    g = applyGuess(g, true);
    expect(g.status).toBe('cleared');
    expect(g.maxStreak).toBe(16);
  });
});
