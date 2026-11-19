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

const ZERO = '何も起きなかった';

export function oddsFor(streak) {
  const denominator = 4 ** streak;
  const percentText = streak === 0 ? '100%' : `1/${denominator.toLocaleString('en-US')}`;
  if (streak === 0) return { denominator, percentText, analogy: ZERO };
  let best = ANALOGIES[0];
  for (const a of ANALOGIES) {
    if (Math.abs(Math.log(denominator / a.denominator)) < Math.abs(Math.log(denominator / best.denominator))) best = a;
  }
  return { denominator, percentText, analogy: best.text };
}
