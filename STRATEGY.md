# Launch Surfer — strategy notes

## What the data said (dev window: 24h, 2–3 Nov 2026, 1222 coins, 35 completions)

An offline analysis of every coin's price path (`analyse.ts`, `analyse2.ts` in
the builder's scratch dir) found:

1. **The edge is at launch, and it decays fast.** Buying at a coin's first
   trade and exiting 10 slots later beats the ~2.7% round-trip fees on ~63% of
   coins. By the 10th trade the win rate is ~30%; by +250 slots the median
   return is 0.
2. **Breadth is the strongest early filter.** Coins whose first 10 trades bring
   ≥ 5 distinct non-creator buyers win >2.7% ~47% of the time; with < 5 buyers
   the win rate collapses to ~7%. A launch bought by one wallet is a dump
   waiting to happen.
3. **The mean is driven by a few runners.** Mean returns are hugely positive
   everywhere while medians sit near zero — a few coins go 10–100×. Exits must
   not cap the upside with a tight take-profit.
4. **Chasing run-ups loses.** Entries after the price already ran >50% from the
   first trade lose money; entries at +15–30% win.
5. **All three house pilots lose on this window** (full-window backtest):
   momentum −9.55 SOL (95% drawdown), reversion −3.93 SOL, sniper −0.49 SOL.
   Sniper is closest to breakeven but its max-buyers ≤ 3 filter selects the
   worst bucket (see point 2) and its tight 15%/12% TP/SL caps the runners.

## The strategy

Watch every coin from its CreateEvent and keep running aggregates of its
opening tape (trades, distinct buyers, net SOL in, creator flow, top-buyer
share). Buy a small fixed stake when, inside the first 50 slots:

- ≥ 8 trades seen, ≥ 6 distinct non-creator buyers,
- net SOL in ≥ 0.3, buys ≥ 60% of trades,
- price +15% to +30% above the first trade's price,
- real SOL ≥ 3 (so the 1% cap still allows a ≥ 0.01 SOL buy),
- **creator's early buys = 0 SOL** (was ≤ 2 SOL — see fix round below),
- creator has not sold,
- no single non-creator buyer holds > 60% of buy SOL.

Hold at most 20 slots. Pyramid into strength: while the position is up ≥ 30%
(was 20%), add up to 0.2 SOL per add (max 3 adds, was 2; ≥ 6 slots apart,
price ≥ 5% above the last buy, ≥ 2 new buyers since) — the 1% cap grows with
the coin's real SOL, so adds are how size gets into runners. Exit on the time
limit, a stop-loss, a trailing stop once armed, or immediately if the creator
sells; a completed curve is closed by the replay. A guardrail pacer opens tiny
0.01 SOL probe round trips on liquid coins if the filled-coin count ever lags
the pace (insurance for the 20-coin minimum on a short final window).

## How the parameters were chosen

Grid sweeps on the full dev window (`tools/sweep.ts`), each setting scored as
the mean over several failed-tx draws, preferring flat regions over single
best cells:

| change | effect on net PnL |
| --- | --- |
| maxHold 150 → 50 → 20 → 10 | −2.16 → −1.47 → +0.26 → worse at 10 with adds |
| maxRunup 2.0 → 0.5 → 0.3 | −2.16 → −0.07 → +0.03 |
| adds (maxAdds 2, addIfUp 0.2, addSol 0.2) | +0.03 → +0.12 |
| maxAge 100 → 50, minRealSol 1 → 3, minBuyers 5 → 6 | +0.12 → +0.19 |
| maxDevBuySol ∞ → 2 SOL | +0.26 → +0.27 |

Final local numbers (5 fail-key draws, full window): net **+0.339 SOL** mean
(+0.338…+0.339 — tighter spread than before), 58 coins, 58 trips, 15 wins,
max drawdown 0.42%. `grade-local --driver process` reproduces this and
reports guardrails met (official run + stress below).

## Fix round (25 Nov 2026) — making the edge survive a fresh window

The first version's weakness: profit concentrated in one jackpot coin (+0.237
of +0.265 SOL); without the top 3 coins net was −0.06 SOL, first 12h −0.008
SOL, and `grade-local --stress 8` median was −0.096 SOL (6/8 copies lost).
Diagnosis from the trip ledger: the 79 non-jackpot trips netted only −0.06
SOL in total — the base is roughly breakeven after the ~2.5% round-trip curve
fees, so the fix had to cut fee-bleed trips and size into real strength,
not chase the jackpot harder.

What changed (all in `DEFAULT_PARAMS`, sweeps in `tools/screen.ts` +
`tools/robust.ts`, each scored on dev net, net-minus-best-trip (exBest),
net-minus-top-3 (exTop3), both 12h halves, and 10 seeded coin-subset
re-runs at 60% and 30% of coins):

| change | effect |
| --- | --- |
| maxDevBuySol 2 → **0** (creator must not have bought at all in the opening tape) | exTop3 −0.063 → −0.046 alone; with minBuyers 6 + adds 3 → −0.026. Creator-bought launches are the worst bucket — the creator's own buys are exit liquidity, not conviction. |
| maxAdds 2 → **3** | net +0.265 → +0.287 alone (adds only pay on runners, so this is jackpot leverage, not base edge). |
| addIfUp 0.2 → **0.3** (adds only once up 30%, not 20%) | net +0.323 → +0.339, H1 flips to +0.012; 0.25 gives the identical result (flat plateau 0.25–0.30), 0.4 is worse (0.241) — 0.3 sits mid-plateau. |
| minBuyers stays 6 | 7 improves exTop3 (−0.019) and H1 (+0.021) but costs net (0.288 vs 0.323) and final-window-scale subset median (+0.011 vs +0.070 at 30% of coins); 8 is worse everywhere. |

What was tried and REJECTED (with numbers, so nobody re-tries them blind):
- Real stop-loss (0.5/0.35/0.25): **no change at all** — losers are slow
  fee bleeds, not dumps; no position ever falls 25% in 20 slots.
- Trailing stop armed at +50%/+100%: slightly worse net (0.251–0.260) — it
  trims the jackpot.
- Shorter maxHold (15/10): exTop3 improves (−0.035) but net collapses
  (0.196/0.117) — the jackpot needs the full 20 slots to run.
- Flat exit (exit at slot 10 if not up): tried as a new param, made
  everything worse (exTop3 −0.019 → −0.039, wins 14 → 9) — flat coins
  bounce by slot 20; the code was removed again.
- Tighter maxTopShare (0.5/0.4): kills the jackpot (net 0.045/0.034).
- maxRunup 0.25 or maxAge 30: both kill the jackpot (net 0.061/0.042).
- minRealSol 5: catastrophic (net −0.014, 0 wins) — winners enter with
  real SOL < 5.
- minBuyShare 0.7: catastrophic (net −0.009) — the jackpot enters below 70%.
- addDelay 4 / addIfUp 0.15 / minTrades 10–12 / buySlipBps 500: all worse
  or neutral. stakeSol and maxExposureSol never bind (the 1% cap does).

Before → after (local sim, default fail key unless noted):

| metric | before | after |
| --- | --- | --- |
| dev net PnL (5 fail keys, mean) | +0.265 | **+0.339** |
| exBest (net minus best trip) | +0.028 | **+0.080** |
| exTop3 (net minus top 3 trips) | −0.063 | **−0.022** |
| first 12h / second 12h | −0.008 / +0.265 | **+0.012 / +0.316** |
| coins / trips / wins | 81 / 82 / 20 | 58 / 58 / 15 |
| max drawdown | 0.42% | 0.42% |
| subset median, 60% of coins (n=10) | +0.225 | **+0.281** |
| subset median, 30% of coins (n=10, final-window scale) | +0.035 | **+0.070** |
| subset p10, 30% of coins | −0.075 | **−0.033** |

Caveat that remains: the filter now passes 58/1222 coins (4.7%) instead of
81 — on a 6h final window (~300 launches) that is ~14 natural coins, so the
guardrail pacer has to supply the rest up to the 20-coin minimum. The pacer
was verified to do exactly that in the 30%-subset runs (filled coins ~35
including probes, 0/10 subsets below 20). Probe cost is ~0.0005 SOL each,
so even 10 probes cost ~0.005 SOL. exTop3 is still slightly negative
(−0.022): the base edge without any of the top 3 coins is not yet proven
positive — the bot is now a breakeven-plus base with a bigger, better-kept
jackpot, not a proven per-trip edge. The official `grade-local --stress 8`
verdict (see "Honest limits") improved the median from −0.096 to −0.06 but
did not reach ≥ 0.

## Honest limits (after the fix round)

- The profit is still concentrated: the top 3 coins make ~85% of the gains;
  without them net PnL is −0.022 SOL (was −0.063). Both 12h halves are now
  positive (+0.012 / +0.316) and the per-trip EV outside the jackpot is
  much closer to zero than before, but it is not proven positive — the bot
  is a breakeven-plus base with a bigger, better-kept jackpot, not a proven
  per-trip edge.
- Stress test (`grade-local --stress 8`, official, 25 Nov 2026): median
  **−0.06 SOL**, p10 −0.07, p90 +0.10; 6 of 8 copies lost money; dev score
  above 8/8. Copies: −0.07, +0.10, −0.06, −0.06, +0.10, −0.02, −0.05, −0.07.
  Better than before the fix (median −0.096, p10 −0.131, p90 +0.040) but
  the target (median ≥ 0) was NOT reached — the copies mostly drop the
  jackpot block, and the jackpot-free base is ≈ −0.05…−0.07 per copy. The
  kit's own note says the copies are a spread, not a forecast of another
  window; the 30%-subset runs (final-window scale) say median +0.070 SOL.
- Official dev grade (`grade-local --driver process`, 25 Nov 2026): net
  **+0.3398 SOL** (90% interval −0.008…+0.850), L1 regrade reproduced byte
  for byte, guardrails met (58 coins, max DD 0.42%), at 2× fees still
  +0.256 SOL.
- So: this bot is roughly breakeven per trip with a lottery ticket on a big
  runner — and it still beats every house pilot on both halves of the window
  (sniper: −0.14/−0.35 SOL; momentum −9.55; reversion −3.93). In a field where
  most entries lose money, a breakeven-plus bot with jackpot upside is
  competitive for a paid place, but the final 6h window can still come out
  negative — the subset runs at final-window scale say median +0.070 SOL
  with 4/10 subsets negative.
- The 6h final window will hold roughly a quarter of the dev window's coins
  (~300 launches, ~14 passing the filter). The guardrail pacer exists for
  exactly this: if filled coins lag the pace it opens 0.01 SOL probe round
  trips to stay above the 20-coin minimum.
