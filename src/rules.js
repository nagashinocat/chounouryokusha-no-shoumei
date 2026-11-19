import { START_BELIEVERS, MAX_MISSES } from './config.js';

export function createGame({ population }) {
  return { believers: START_BELIEVERS, streak: 0, maxStreak: 0, rounds: 0, misses: 0, population, status: 'playing' };
}

export function isFateRound(game) {
  return game.status === 'playing' && game.believers * 4 >= game.population;
}

export function applyGuess(game, hit) {
  if (game.status !== 'playing') return game;
  const rounds = game.rounds + 1;
  if (hit) {
    const believers = game.believers * 4;
    const streak = game.streak + 1;
    return {
      ...game, believers, streak, rounds,
      maxStreak: Math.max(game.maxStreak, streak),
      status: believers >= game.population ? 'cleared' : 'playing',
    };
  }
  const believers = Math.floor((game.believers * 3) / 4);
  const misses = game.misses + 1;
  // 運命の選択は一度きり。外したらそこで終わり
  const over = believers <= 0 || misses >= MAX_MISSES || isFateRound(game);
  return { ...game, believers, misses, streak: 0, rounds, status: over ? 'over' : 'playing' };
}
