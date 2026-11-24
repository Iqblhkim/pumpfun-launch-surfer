// Offline backtest of strategy.ts on the kit's full dev window with the local engine
// port (tools/sim.ts). The bot never imports this file; the grader's own engine is
// what scores. Runs the default fail-key draw plus 4 others and reports the spread,
// so a setting that only wins on one lucky failed-tx draw stands out.
//
//   node tools/backtest.ts <kit dir> ['{"stakeSol":0.2}'] [--trips]
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';
import { loadDataset, makeHello, phaseSeed, simulate } from './sim.ts';

const kit = process.argv[2];
if (kit === undefined) {
  console.error('usage: node tools/backtest.ts <kit dir> [params json] [--trips]');
  process.exit(2);
}
const overrides = process.argv[3] !== undefined && process.argv[3].startsWith('{') ? (JSON.parse(process.argv[3]) as Partial<Params>) : {};
const ds = loadDataset(kit);
const hello = makeHello(phaseSeed('pilot-pumpfun-replay', 'dev', ds.sha256));
const params = { ...DEFAULT_PARAMS, ...overrides };
const sol = (x: bigint) => (Number(x) / 1e9).toFixed(4);
const FAIL_KEYS: (bigint | null)[] = [null, 11n, 22n, 33n, 44n];
const nets: number[] = [];
for (const fk of FAIL_KEYS) {
  const r = simulate(ds, hello, createStrategy(params), fk === null ? {} : { failKey: fk });
  const wins = r.trips.filter((t) => t.pnl > 0n).length;
  const sorted = [...r.trips].map((t) => Number(t.pnl) / 1e9).sort((a, b) => b - a);
  const exBest = Number(r.netPnl) / 1e9 - (sorted[0] ?? 0);
  nets.push(Number(r.netPnl) / 1e9);
  console.log(
    `failKey=${fk === null ? 'default' : fk} net ${sol(r.netPnl)} SOL fills ${r.fills} coins ${r.mints} trips ${r.trips.length} wins ${wins} dd ${r.maxDrawdown.toFixed(4)} rejected ${r.rejected} failed ${r.failed} exBest ${exBest.toFixed(4)} ${JSON.stringify(r.rejectReasons)}`,
  );
}
nets.sort((a, b) => a - b);
console.log(`mean ${(nets.reduce((a, b) => a + b, 0) / nets.length).toFixed(4)} median ${nets[2].toFixed(4)} min ${nets[0].toFixed(4)} max ${nets[4].toFixed(4)}`);
if (process.argv.includes('--trips')) {
  const r = simulate(ds, hello, createStrategy(params));
  for (const t of r.trips) console.log(t.mint.slice(0, 8), t.open, t.close - t.open, sol(t.pnl));
}
