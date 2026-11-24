// Launch Surfer: an early-launch momentum bot for the pump.fun bonding-curve replay
// (agent-fun/replay/v2). Strategy in strategy.ts; the wire shim is the kit's SDK,
// vendored byte for byte in vendor/makefun-bot.ts.

import { runBot } from './vendor/makefun-bot.ts';
import { createStrategy, DEFAULT_PARAMS } from './strategy.ts';

await runBot(createStrategy(DEFAULT_PARAMS));
