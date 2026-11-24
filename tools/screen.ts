// One-shot screen for a param set: full dev window + both halves + exBest +
// exTop3 (net without the 3 best trips — the jackpot-free edge). A setting
// only counts as robust if exTop3 >= 0 and both halves >= 0.
//
//   node tools/screen.ts <kit dir> '{params}' [label]
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';
import { loadDataset, makeHello, phaseSeed, simulate } from './sim.ts';

const kit = process.argv[2];
if (kit === undefined) {
  console.error('usage: node tools/screen.ts <kit dir> [params json] [label]');
  process.exit(2);
}
const overrides = process.argv[3] !== undefined && process.argv[3].startsWith('{') ? (JSON.parse(process.argv[3]) as Partial<Params>) : {};
const label = process.argv[4] ?? JSON.stringify(overrides);
const ds = loadDataset(kit);
const hello = makeHello(phaseSeed('pilot-pumpfun-replay', 'dev', ds.sha256));
const params = { ...DEFAULT_PARAMS, ...overrides };
const sol = (x: bigint) => Number(x) / 1e9;

const summarize = (r: ReturnType<typeof simulate>) => {
  const trips = [...r.trips].map((t) => sol(t.pnl)).sort((a, b) => b - a);
  const top3 = trips.slice(0, 3).reduce((a, b) => a + b, 0);
  return {
    net: sol(r.netPnl),
    exBest: sol(r.netPnl) - (trips[0] ?? 0),
    exTop3: sol(r.netPnl) - top3,
    coins: r.mints,
    trips: r.trips.length,
    wins: r.trips.filter((t) => t.pnl > 0n).length,
    dd: r.maxDrawdown,
  };
};

const full = summarize(simulate(ds, hello, createStrategy(params)));
const mid = (ds.batches[0]!.slot + ds.batches[ds.batches.length - 1]!.slot) / 2;
const createdSecond = new Set<string>();
for (const b of ds.batches) {
  if (b.slot < mid) continue;
  for (const e of b.events) if (e.event === 'CreateEvent') createdSecond.add(e.mint);
}
const secondBatches = ds.batches
  .filter((b) => b.slot >= mid)
  .map((b) => ({ slot: b.slot, events: b.events.filter((e: any) => createdSecond.has(e.mint)) }))
  .filter((b) => b.events.length > 0);
const h1 = summarize(simulate({ ...ds, batches: ds.batches.filter((b) => b.slot < mid), endSlot: Math.floor(mid) }, hello, createStrategy(params)));
const h2 = summarize(simulate({ ...ds, batches: secondBatches, endSlot: ds.endSlot }, hello, createStrategy(params)));
console.log(
  `${label} | net ${full.net.toFixed(4)} exBest ${full.exBest.toFixed(4)} exTop3 ${full.exTop3.toFixed(4)} coins ${full.coins} trips ${full.trips} wins ${full.wins} dd ${full.dd.toFixed(4)} | H1 ${h1.net.toFixed(4)} (exT3 ${h1.exTop3.toFixed(4)}) H2 ${h2.net.toFixed(4)} (exT3 ${h2.exTop3.toFixed(4)})`,
);
