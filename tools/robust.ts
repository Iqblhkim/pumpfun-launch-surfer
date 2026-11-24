// Robustness proxy for grade-local --stress: run the strategy on random
// subsets of the dev window's coins (seeded, no replacement) and report the
// spread of net PnL. A setting whose median over subsets is >= 0 does not
// depend on this window's particular coins.
//
//   node tools/robust.ts <kit dir> ['{params}'] [n=10] [frac=0.6]
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';
import { loadDataset, makeHello, phaseSeed, simulate } from './sim.ts';

const kit = process.argv[2];
if (kit === undefined) {
  console.error('usage: node tools/robust.ts <kit dir> [params json] [n] [frac]');
  process.exit(2);
}
const overrides = process.argv[3] !== undefined && process.argv[3].startsWith('{') ? (JSON.parse(process.argv[3]) as Partial<Params>) : {};
const n = Number(process.argv[4] ?? 10);
const frac = Number(process.argv[5] ?? 0.6);
const ds = loadDataset(kit);
const hello = makeHello(phaseSeed('pilot-pumpfun-replay', 'dev', ds.sha256));
const params = { ...DEFAULT_PARAMS, ...overrides };

// Seeded PRNG (mulberry32).
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const mints: string[] = [];
for (const b of ds.batches) {
  for (const e of b.events) if (e.event === 'CreateEvent' && !mints.includes(e.mint)) mints.push(e.mint);
}
const nets: number[] = [];
const coinsArr: number[] = [];
for (let i = 0; i < n; i++) {
  const r = rng(1000 + i);
  const keep = new Set<string>();
  const shuffled = [...mints];
  for (let j = shuffled.length - 1; j > 0; j--) {
    const k = Math.floor(r() * (j + 1));
    [shuffled[j], shuffled[k]] = [shuffled[k]!, shuffled[j]!];
  }
  for (let j = 0; j < Math.floor(shuffled.length * frac); j++) keep.add(shuffled[j]!);
  const batches = ds.batches
    .map((b) => ({ slot: b.slot, events: b.events.filter((e: any) => keep.has(e.mint)) }))
    .filter((b) => b.events.length > 0);
  const sub = { ...ds, batches };
  const res = simulate(sub, hello, createStrategy(params));
  nets.push(Number(res.netPnl) / 1e9);
  coinsArr.push(res.mints);
}
nets.sort((a, b) => a - b);
const med = nets[Math.floor(n / 2)];
const p10 = nets[Math.floor(n * 0.1)];
const p90 = nets[Math.floor(n * 0.9)];
const neg = nets.filter((x) => x < 0).length;
console.log(
  `robust n=${n} frac=${frac}: median ${med.toFixed(4)} p10 ${p10.toFixed(4)} p90 ${p90.toFixed(4)} min ${nets[0]!.toFixed(4)} max ${nets[n - 1]!.toFixed(4)} neg ${neg}/${n} coins~${Math.round(coinsArr.reduce((a, b) => a + b, 0) / coinsArr.length)}`,
);
