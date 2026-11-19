import { randomIndex } from './rng.js';

export const SURNAMES = ['佐藤','鈴木','高橋','田中','伊藤','渡辺','山本','中村','小林','加藤','吉田','山田','佐々木','山口','松本','井上','木村','林','斎藤','清水','山崎','森','池田','橋本','阿部','石川','山下','中島','石井','小川','前田','岡田'];
export const MALE = ['健一','誠','大輔','翔太','拓也','浩','隆','直樹','和也','達也','亮','剛','修','秀樹','茂','学','聡','悠斗','蓮','陽太','勇気','正和'];
export const FEMALE = ['陽子','恵子','美咲','由美','裕子','直美','真由美','愛','彩','結衣','明美','智子','久美子','さくら','葵','花子','舞','千尋','麻衣','優子','京子','芽衣'];
export const JOBS = ['会社員','コンビニ店員','公務員','大学生','フリーター','タクシー運転手','主婦','主夫','漁師','郵便配達員','パン屋','清掃員','警備員','保育士','農家','美容師','銀行員','プログラマー','八百屋','教師','トラック運転手','無職'];

export function makeChallenger(number, pick = randomIndex) {
  const surname = SURNAMES[pick(SURNAMES.length)];
  const gender = pick(2) === 0 ? 'm' : 'f';
  const names = gender === 'm' ? MALE : FEMALE;
  const given = names[pick(names.length)];
  const job = JOBS[pick(JOBS.length)];
  const age = 18 + pick(58);
  const name = `${surname} ${given}`;
  const label = `挑戦者 No.${String(number).padStart(4, '0')} ${name}(${age}) ${job}`;
  return { number, name, age, job, gender, label };
}

export function gameOverText() {
  return 'その後、人口が1人減ったが誰も気づかなかった。';
}
