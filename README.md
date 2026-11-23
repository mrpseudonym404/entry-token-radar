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

## The model (radar-2)

Implied value follows only from the snapshot's own figures — no protocol name is ever
special-cased:

```
Implied = TVL x M_cat x G x B x A x D
```

- **M_cat** — the winsorized median mcap/TVL of tokenized peers in the *same* category
  (peers: snapshot protocols with a market cap and TVL ≥ $1M; ratio clipped to
  [0.02, 3.0]; median of the peers). If a category has fewer than 3 peers, the global
  fallback **0.17** (the winsorized median over all 144 tokenized peers) applies.
  Computed from the snapshot at runtime, never hardcoded. Reference values: Dexs 0.34,
  Lending 0.13, RWA 0.27, Basis Trading 0.48, Yield 0.12, Yield Aggregator 0.05,
  CDP 0.17, Onchain Capital Allocator 0.02, Privacy 0.97, Indexes 0.15.
- **G** — growth: `1 + clamp(change_7d / 100, -0.20, +0.30)`; 1.00 when unreported.
- **B** — breadth: `1 + 0.05 x min(max(chains - 1, 0), 10)`; 1.00 for one chain, 1.50 for 11+.
- **A** — age: `0.70 + 0.10 x min(age_years, 3)`; 0.80 when the listing date is unknown.
- **D** — a flat 0.50 launch-uncertainty haircut, uniform across every row.

The board is the whole 40-protocol watchlist plus every rankable protocol below the
$50M floor: **178 rows**. Curator and allocator rows (whose TVL is vaults managed on top
of other protocols) are flagged `curator — TVL is managed vaults`, never dropped. A
protocol is said to *record* no token — the snapshot carries no airdrop flag and no
launch date, and no farm plan promises one.

This beats the starter's flat 0.25x multiple for every category: a lending protocol and
a derivatives protocol are worth different multiples of their TVL, and the board shows
which multiple each row used, how many peers set it, and the peer range — so every
implied value is auditable, not asserted.

## The board

| Rank | Protocol | Category | TVL | Multiple | Implied |
|-----:|----------|----------|----:|--------:|--------:|
| 1 | Steakhouse Financial | Risk Curators | $2.75B | 0.17x | $291.48M |
| 2 | Gauntlet | Risk Curators | $1.58B | 0.17x | $180.35M |
| 3 | USDD | CDP | $1.06B | 0.17x | $82.57M |
| 4 | Bittensor dTAO | Dexs | $376.03M | 0.34x | $43.03M |
| 5 | OnRe | RWA | $308.88M | 0.27x | $35.42M |
| 6 | OpenTrade | RWA | $241.50M | 0.27x | $32.09M |
| 7 | Plume Vaults | RWA | $211.54M | 0.27x | $30.60M |
| 8 | Nonce Capital | Risk Curators | $513.78M | 0.17x | $29.48M |
| 9 | RockawayX | Risk Curators | $292.51M | 0.17x | $26.83M |
| 10 | Hyperithm | Risk Curators | $221.64M | 0.17x | $22.17M |

Total implied value across the 178 rows: **$1.25B**.

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
- `lib/model.ts` — the radar-2 model, the board builder, the farm plans, the data.js
  generator, the snapshot parser and the board validator.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied unmodified from the kit.
- `dashboard/` — `index.html`, `app.css`, `app.js` (30,039 bytes in all, under the 64 KB
  the judge reads whole). No network, system fonts only.
- `screenshots/` — `board.png`, `detail.png`, `filtered.png` (1440x900 each).

## License

MIT — see `LICENSE`.
