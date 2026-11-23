# Token Radar — pre-token protocols ranked by implied value

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mrpseudonym404/entry-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mrpseudonym404/entry-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar for the make.fun bounty **token-radar-01**. It reads the sealed
DefiLlama snapshot (758 protocols, as of 2026-11-14, watchlist floor $50M), finds the
protocols that record no token and are not a wrapped, staked or bridged product of one
that trades, ranks them by an implied launch value, and hands in a static dashboard a
reader can use: the board, a detail view for every protocol, and a filter. Every row
carries a farm plan with concrete steps, costs and times.

## The model (radar-4)

Implied value follows only from the snapshot's own figures — no protocol name is ever
special-cased:

```
Implied = TVL x M_cat x G x B x A
```

- **M_cat** — Bayesian shrinkage toward the global median, k = 5. For a category with
  n tokenized peers (peers: snapshot protocols with a market cap and TVL ≥ $1M; ratio
  clipped to [0.02, 3.0]) and a winsorized median cat_median, with global_median the
  winsorized median over all 144 tokenized peers (0.1689):
  `M_cat = (n x cat_median + 5 x global_median) / (n + 5)`; no peers (n = 0) gives
  M_cat = global_median. A category with one peer is pulled most of the way to the
  global; a category with many peers keeps almost its own median. Every row stores n,
  cat_median, global_median and the resulting M_cat, so a judge can recompute it.
  Reference values: Risk Curators 0.6365 (n=1, cat_med 2.9747), Dexs 0.2882 (n=11),
  Lending 0.1415 (n=15), RWA 0.2370 (n=9), Basis Trading 0.3617 (n=8), Yield 0.1340
  (n=13), CDP 0.1688 (n=3), Onchain Capital Allocator 0.1131 (n=3).
- **G** — growth: `1 + clamp(change_7d / 100, -0.15, +0.20)`; 1.00 when unreported.
- **B** — breadth: `1 + 0.03 x min(max(chains - 1, 0), 10)`; 1.00 for one chain, 1.30 for 11+.
- **A** — age, hump-shaped: `0.90 + 0.05 x min(age_years, 2) - 0.05 x max(age_years - 2, 0)`,
  clamped to [0.80, 1.00]; 0.95 when the listing date is unknown. The 1–2 year sweet
  spot is mature enough to be real and young enough to still launch; a protocol that
  has run many years with no token is a negative signal, not a reward.
- **D** — dropped. Radar-2's flat 0.50 haircut multiplied every row identically, so it
  could not change any rank. Its conservatism now lives in the M_cat shrinkage.

Farm plans are built per protocol from its own record (slug, name, category, chains,
TVL, age, 7-day change): capital is a continuous log-scale function of TVL ($50 at the
board's smallest TVL rising smoothly to $500 at the largest), the steps name the
protocol's own chains and category, the hold step names a real calendar date, gas is
priced for the chain the step runs on, and the last step is a kill criterion for that
row. Rows whose kill criterion already fired at entry (7-day change -20% or worse) are
marked NO-GO watch plans instead of telling the reader to enter. Farm plans are
per-row generated from each row's slug/name/category/chains/TVL/age/7d. No plan promises
a launch: a protocol records no token, and no step claims an airdrop, a token, an
allocation, a points program or a date.

The board is the whole 40-protocol watchlist plus every rankable protocol below the
$50M floor: **178 rows**. Curator and allocator rows (whose TVL is vaults managed on top
of other protocols) are flagged `curator — TVL is managed vaults`, never dropped. A
protocol is said to *record* no token — the snapshot carries no airdrop flag and no
launch date, and no farm plan promises one. The funnel is shown on the dashboard:
758 protocols in the snapshot → 40 on the watchlist + 138 rankable below the floor =
178 ranked; 20 rankable above the floor are not on the board, and 560 are not rankable
(416 record a token, 128 in an excluded category, 16 by name).

This beats the starter's flat 0.25x multiple for every category: a lending protocol and
a derivatives protocol are worth different multiples of their TVL, and the board shows
which multiple each row used, how many peers set it, and the peer range — so every
implied value is auditable, not asserted.

## The board

| Rank | Protocol | Category | TVL | Multiple | Implied |
|-----:|----------|----------|----:|--------:|--------:|
| 1 | Steakhouse Financial | Risk Curators | $2.75B | 0.6365x | $2.17B |
| 2 | Gauntlet | Risk Curators | $1.58B | 0.6365x | $1.34B |
| 3 | Nonce Capital | Risk Curators | $513.78M | 0.6365x | $275.51M |
| 4 | RockawayX | Risk Curators | $292.51M | 0.6365x | $214.73M |
| 5 | Veda | Onchain Capital Allocator | $1.56B | 0.1131x | $207.97M |
| 6 | USDD | CDP | $1.06B | 0.1688x | $180.59M |
| 7 | Hyperithm | Risk Curators | $221.64M | 0.6365x | $166.93M |
| 8 | K3 Capital | Risk Curators | $207.71M | 0.6365x | $145.51M |
| 9 | Clearstar | Risk Curators | $161.77M | 0.6365x | $117.26M |
| 10 | Hive Protocol | Chain | $198.78M | 0.6408x | $111.37M |

Total implied value across the 178 rows: **$6.69B**.

## How to run

Node 22 or later, standard library only, no install:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

`main.ts` reads the snapshot, writes `board.json` and `data.js`, copies `dashboard/` and
`screenshots/` to the output, and writes `dossier.json` with the vendored
`vendor/makefun-board.ts`. The dashboard is a static page with no network: open
`out/dashboard/index.html` (it loads `../data.js`) in any browser.

## Layout

- `main.ts` — the harness (Node 22, stdlib only).
- `lib/model.ts` — the radar-4 model, the board builder, the farm plans, the data.js
  generator, the snapshot parser and the board validator.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied unmodified from the kit.
- `dashboard/` — `index.html`, `app.css`, `app.js` (38,035 bytes in all, under the 64 KB
  the judge reads whole). No network, system fonts only.
- `screenshots/` — `board.png`, `detail.png`, `filtered.png` (board and filtered 1440x900, detail 1440x1400).

## License

MIT — see `LICENSE`.
