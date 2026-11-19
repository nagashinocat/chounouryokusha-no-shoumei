import { getLang } from './i18n.js';

// たとえはすべて計算で確かめられる値か、公式に公表されている当せん確率。
export const ANALOGIES = [
  { denominator: 2, text: 'コインを投げて表が出る' },
  { denominator: 4, text: 'コインを2回投げて2回とも表が出る' },
  { denominator: 6, text: 'サイコロを振って1の目が出る' },
  { denominator: 13, text: 'トランプの山からエースを引く' },
  { denominator: 36, text: 'サイコロを2個振ってピンゾロが出る' },
  { denominator: 52, text: 'トランプの1枚を言い当てる' },
  { denominator: 216, text: 'サイコロを3個振って全部1の目が出る' },
  { denominator: 365, text: '知らない人の誕生日を1回で言い当てる' },
  { denominator: 1024, text: 'コインを10回投げて全部表が出る' },
  { denominator: 2704, text: 'トランプの1枚を2回続けて言い当てる' },
  { denominator: 46656, text: 'サイコロを6個振って全部1の目が出る' },
  { denominator: 140608, text: 'トランプの1枚を3回続けて言い当てる' },
  { denominator: 649740, text: 'ポーカーで配られた5枚がいきなりロイヤルストレートフラッシュ' },
  { denominator: 1048576, text: 'コインを20回投げて全部表が出る' },
  { denominator: 6096454, text: 'ロト6で1等が当たる' },
  { denominator: 16777216, text: 'フルカラー画面の1600万色から1色を言い当てる' },
  { denominator: 60466176, text: 'サイコロを10個振って全部1の目が出る' },
  { denominator: 1073741824, text: 'コインを30回投げて全部表が出る' },
  { denominator: 8200000000, text: '地球上の全人類から1人を指さして当てる' },
  { denominator: 34359738368, text: 'コインを35回投げて全部表が出る' },
];

// 英語版：分母は日本語版と同じ。ロト6は「43個から6個を当てる」宝くじとして言い換える
export const ANALOGIES_EN = [
  [2, 'flipping heads on a coin'], [4, 'flipping heads twice in a row'], [6, 'rolling a 1 on a die'],
  [13, 'drawing an ace from a deck of cards'], [36, 'rolling snake eyes with two dice'], [52, 'naming a card from a deck'],
  [216, 'rolling three 1s with three dice'], [365, "guessing a stranger's birthday on the first try"],
  [1024, 'flipping 10 heads in a row'], [2704, 'naming a card from a deck twice in a row'],
  [46656, 'rolling six 1s with six dice'], [140608, 'naming a card from a deck three times in a row'],
  [649740, 'being dealt a royal flush in your first five cards'], [1048576, 'flipping 20 heads in a row'],
  [6096454, 'winning a pick-6-of-43 lottery jackpot'], [16777216, 'guessing one exact color out of 16.7 million'],
  [60466176, 'rolling ten 1s with ten dice'], [1073741824, 'flipping 30 heads in a row'],
  [8200000000, 'pointing at one person among all of humanity and getting it right'], [34359738368, 'flipping 35 heads in a row'],
].map(([denominator, text]) => ({ denominator, text }));

const ZERO = '何も起きなかった';
const ZERO_EN = 'nothing happening at all';

export function oddsFor(streak) {
  const denominator = 4 ** streak;
  const percentText = streak === 0 ? '100%' : `1/${denominator.toLocaleString('en-US')}`;
  const en = getLang() === 'en', list = en ? ANALOGIES_EN : ANALOGIES;
  if (streak === 0) return { denominator, percentText, analogy: en ? ZERO_EN : ZERO };
  let best = list[0];
  for (const a of list) {
    if (Math.abs(Math.log(denominator / a.denominator)) < Math.abs(Math.log(denominator / best.denominator))) best = a;
  }
  return { denominator, percentText, analogy: best.text };
}
