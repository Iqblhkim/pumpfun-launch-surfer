# Launch Surfer — Pump.fun Bot Sprint entry

[![make.fun](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![rank](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/Iqblhkim/pumpfun-launch-surfer/rank.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![reward](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/Iqblhkim/pumpfun-launch-surfer/reward.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)

A trading bot for the [Pump.fun Bot Sprint: Make Bot And Win](https://make.fun/c/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
competition on [make.fun](https://make.fun/). It trades paper SOL on a replay of
pump.fun bonding-curve events (agent-fun/replay/v2), ranked on net PnL.

## Strategy

**Launch Surfer** buys the opening minutes of a new coin's life — that is where
the edge is on the dev window (buying at the first trade and exiting ~10 slots
later beats round-trip fees on ~63% of coins; the edge decays fast as a coin
ages). It only buys when the opening tape shows *breadth*: at least 6 distinct
non-creator buyers across at least 8 trades, with the price up 15–30% from the
first trade (never chasing a launch that already ran >30%), at least 3 SOL of
real reserves, and the creator's own early buys under 2 SOL. Positions are small
(the 1%-of-real-reserve cap keeps the first buy tiny), held at most 20 slots,
and pyramided into strength — adds fire only while the position is up ≥20%,
which is how size gets into the few coins that run. Exits: a 20-slot time limit,
a stop-loss, a trailing stop once armed, or immediately if the creator sells.

Fully deterministic: a pure function of the batches the harness sends — no
clock, no randomness, no I/O. The two graded executions reproduce byte for byte.

See [STRATEGY.md](STRATEGY.md) for the full design, the data analysis behind
it, and the local test results.

## Layout

- `main.ts` — entrypoint (`node main.ts`).
- `strategy.ts` — the strategy (own work).
- `vendor/makefun-bot.ts` — the kit's SDK shim, vendored byte for byte.
- `tools/sim.ts` — a local port of the kit's replay engine (offline use only;
  the bot never imports it).
- `tools/backtest.ts` — backtest on the kit's full dev window over 5 fail-key draws.
- `tools/sweep.ts` — parameter grid sweep over the same.

## Local results (kit dev window, 24h, 1222 coins)

`node tools/backtest.ts <kit>` and `grade-local --driver process`:

- Net PnL **+0.339 SOL** (return +3.39%), 90% interval −0.008 … +0.850 SOL
- 58 coins, 58 round trips, 15 wins, max drawdown 0.42%
- At 2× fees still +0.256 SOL
- Guardrails met: 58 coins hold a round trip ≥ 0.01 SOL, drawdown ok
- Determinism: L1 regrade reproduced byte for byte

## License

MIT — see [LICENSE](LICENSE).
