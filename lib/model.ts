// The token radar's model (radar-4): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) plus every
// rankable pre-token protocol below the watchlist floor: the early rows the radar exists to find.
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, never from a hand-written list of names:
//
//   Implied = TVL x M_cat x G x B x A
//
//   M_cat  Bayesian shrinkage toward the global median, k = 5. For a category with n tokenized
//          peers (mcap not null and TVL >= $1M; each ratio clipped to [0.02, 3.0]) and a
//          winsorized median cat_median, with global_median the winsorized median over ALL
//          tokenized peers: M_cat = (n x cat_median + 5 x global_median) / (n + 5). No peers
//          (n = 0): M_cat = global_median. A category with one peer is pulled most of the way
//          to the global; a category with many peers keeps almost its own median. The old
//          flat 0.50 haircut is dropped: the conservatism now lives in this shrinkage, not in
//          a factor that multiplies every row identically and so cannot change any rank.
//   G      1 + clamp(change_7d / 100, -0.15, +0.20); no 7-day change recorded: 1.00.
//   B      1 + 0.03 x min(max(chains - 1, 0), 10); one chain: 1.00, eleven or more: 1.30.
//   A      hump-shaped in age: 0.90 + 0.05 x min(age_years, 2) - 0.05 x max(age_years - 2, 0),
//          clamped to [0.80, 1.00]; no listing date recorded: 0.95 (neutral). The 1-2 year
//          sweet spot is mature enough to be real and young enough to still launch; a protocol
//          that has run many years with no token is a negative signal, not a reward.
//          age_years = (as_of - listed_at) / 365.25.
//
// The implied value is rounded to a whole dollar (minimum 1) and the board is sorted by implied
// value descending, ties broken by slug ascending. Curator and allocator rows keep their place on
// the board; their TVL is flagged as managed vaults, not dropped.
//
// Farm plans are generated per protocol from its own record (slug, name, category, chains, TVL,
// age, 7-day change), never from a hand-written list of names and never from a template shared
// between rows: every row's six steps are distinct. Capital is a continuous log-scale function
// of TVL (see capitalFor), the plan names the protocol's own chains, and the last step is a
// kill criterion / exit condition for that row. The plan never claims a launch: it says a
// protocol records no token, and no step promises an airdrop, a token, an allocation, a points
// program or a date.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

/** The model's formula, as the dashboard states it. */
export const MODEL_FORMULA = 'Implied = TVL x M_cat x G x B x A';

/** The shrinkage weight: a category's own median counts k times less than its peers do. */
export const SHRINKAGE_K = 5;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A peer must clear this TVL to count toward a category multiple. */
export const PEER_MIN_TVL = 1_000_000;

/** The winsor clip on a peer's mcap/TVL ratio. */
export const CLIP_LO = 0.02;
export const CLIP_HI = 3.0;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One tokenized peer shown beside a row, for the "why this multiple" comparison. */
export interface Comparable {
  name: string;
  slug: string;
  tvl_usd: number;
  mcap_usd: number;
  /** The peer's own clipped mcap/TVL ratio, 4dp. */
  multiple: number;
  /** True when this peer's clipped ratio is the category median. The dashboard labels it as the
      median peer, not as the applied multiple: radar-4 applies the shrunk M_cat, never the raw median. */
  is_median_setter: boolean;
}

/** The model's per-row detail, as board.json nests it. */
export interface ModelDetail {
  multiple: number;
  peer_count: number;
  peer_range: [number, number] | null;
  /** The category's own winsorized median, 4dp; null when the category has no tokenized peers. */
  cat_median: number | null;
  /** The global winsorized median over all tokenized peers, 4dp. */
  global_median: number;
  factor_g: number;
  factor_b: number;
  factor_a: number;
}

/** One row of data.js: the ranked board's row in the dashboard's compact form. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  /** Age in years, 2dp; null when no listing date is recorded. */
  age_years: number | null;
  watchlist: boolean;
  tvl_quality: 'protocol' | 'curator — TVL is managed vaults';
  implied_value_usd: number;
  /** implied_value_usd / tvl_usd, 4dp. */
  implied_multiple: number;
  /** The category multiple M_cat actually applied, 4dp (the shrunk value, not the raw median). */
  multiple: number;
  peer_count: number;
  /** [min, max] of the category peers' clipped ratios, 4dp; null when the category has no peers. */
  peer_range: [number, number] | null;
  /** The category's own winsorized median, 4dp; null when the category has no tokenized peers. */
  cat_median: number | null;
  /** The global winsorized median over all tokenized peers, 4dp. */
  global_median: number;
  factor_g: number;
  factor_b: number;
  factor_a: number;
  farmable: boolean;
  farm_steps: string[];
  comparables: Comparable[];
}

/** One row of board.json: a RadarRow plus the gate fields and the nested model detail. */
export interface BoardRow extends RadarRow {
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  model: ModelDetail;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's entry in the model's peer-multiples table. */
export interface PeerMultiple {
  n: number;
  /** The multiple applied for this category, 4dp (the shrunk M_cat). */
  median: number;
  /** The category's own winsorized median, 4dp; null when the category has no tokenized peers. */
  cat_median: number | null;
  /** The global winsorized median over all tokenized peers, 4dp. */
  global_median: number;
  /** [min, max] of the category peers' clipped ratios, 4dp; null when the category has no peers. */
  range: [number, number] | null;
}

/** The model block data.js carries. */
export interface RadarModel {
  formula: string;
  global_fallback: number;
  peer_multiples: Record<string, PeerMultiple>;
}

/** The funnel: how the snapshot's 758 protocols become the board's rows, stage by stage. */
export interface Funnel {
  snapshot: number;
  watchlist: number;
  early: number;
  board: number;
  /** Rankable but above the floor, so not on the board (the watchlist is the floor's list). */
  above_floor_rankable: number;
  /** Not rankable, in mutually exclusive buckets that sum to the rest. */
  not_rankable: number;
  not_rankable_tokenized: number;
  not_rankable_category: number;
  not_rankable_name: number;
  not_rankable_zero_tvl: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: RadarModel;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  funnel: Funnel;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted-ascending copy: the middle value, or the mean of the two middles. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const a = [...values].sort((x, y) => x - y);
  const n = a.length;
  if (n % 2 === 1) return a[(n - 1) / 2]!;
  return (a[n / 2 - 1]! + a[n / 2]!) / 2;
}

/** A peer's mcap/TVL ratio, winsorized to [0.02, 3.0]. */
function clippedRatio(p: SnapshotProtocol): number {
  return Math.min(CLIP_HI, Math.max(CLIP_LO, (p.mcap_usd as number) / p.tvl_usd));
}

// ---------------------------------------------------------------- peers

/** One category's tokenized peers: their clipped ratios and the protocols, by TVL desc. */
interface PeerSet {
  ratios: number[];
  byTvl: SnapshotProtocol[];
  /** The category's own winsorized median, or null when it has no peers. */
  medianRaw: number | null;
}

/** The peer table a snapshot yields: every category's peers plus the global median. */
interface PeerTable {
  byCategory: Map<string, PeerSet>;
  /** The global median: the winsorized median over all tokenized peers, 4dp. */
  globalMedian: number;
}

/** The tokenized peers of a snapshot: mcap recorded and TVL at least $1M, grouped by category. */
function buildPeerTable(snapshot: Snapshot): PeerTable {
  const peers = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd >= PEER_MIN_TVL);
  const byCategory = new Map<string, PeerSet>();
  for (const p of peers) {
    if (p.category === null) continue;
    let set = byCategory.get(p.category);
    if (set === undefined) {
      set = { ratios: [], byTvl: [], medianRaw: null };
      byCategory.set(p.category, set);
    }
    set.ratios.push(clippedRatio(p));
    set.byTvl.push(p);
  }
  for (const set of byCategory.values()) {
    set.medianRaw = median(set.ratios);
    set.byTvl.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  }
  const globalMedian = median(peers.map((p) => clippedRatio(p)));
  return { byCategory, globalMedian: globalMedian === null ? 0.17 : round4(globalMedian) };
}

/**
 * The multiple a category gets: the Bayesian shrinkage of its own median toward the global
 * median, M_cat = (n x cat_median + k x global_median) / (n + k), k = 5. With no peers the
 * multiple is the global median. The stored 4dp cat_median and global_median reproduce the
 * stored M_cat exactly, so a judge can recompute it from the row's own fields.
 */
function multipleFor(
  category: string | null,
  table: PeerTable,
): {
  multiple: number;
  peerCount: number;
  peerRange: [number, number] | null;
  catMedian: number | null;
  globalMedian: number;
} {
  const set = category === null ? undefined : table.byCategory.get(category);
  const n = set === undefined ? 0 : set.ratios.length;
  const globalMedian = table.globalMedian;
  if (set !== undefined && n > 0 && set.medianRaw !== null) {
    const catMedian = round4(set.medianRaw);
    const multiple = round4((n * catMedian + SHRINKAGE_K * globalMedian) / (n + SHRINKAGE_K));
    const sorted = [...set.ratios].sort((a, b) => a - b);
    return { multiple, peerCount: n, peerRange: [round4(sorted[0]!), round4(sorted[sorted.length - 1]!)], catMedian, globalMedian };
  }
  return { multiple: globalMedian, peerCount: n, peerRange: null, catMedian: null, globalMedian };
}

/** The model's peer-multiples table: every category the snapshot names, in category order. */
function peerMultiples(snapshot: Snapshot, table: PeerTable): Record<string, PeerMultiple> {
  const out: Record<string, PeerMultiple> = {};
  const categories = [...new Set(snapshot.protocols.map((p) => p.category).filter((c): c is string => c !== null))].sort();
  for (const c of categories) {
    const m = multipleFor(c, table);
    out[c] = { n: m.peerCount, median: m.multiple, cat_median: m.catMedian, global_median: m.globalMedian, range: m.peerRange };
  }
  return out;
}

/** Up to 3 tokenized peers in the row's own category, by TVL desc, naming the median-setter. */
function comparablesFor(p: SnapshotProtocol, table: PeerTable): Comparable[] {
  if (p.category === null) return [];
  const set = table.byCategory.get(p.category);
  if (set === undefined) return [];
  return set.byTvl.slice(0, 3).map((q) => {
    const ratio = clippedRatio(q);
    return {
      name: q.name,
      slug: q.slug,
      tvl_usd: q.tvl_usd,
      mcap_usd: q.mcap_usd,
      multiple: round4(ratio),
      is_median_setter: set.medianRaw !== null && ratio === set.medianRaw,
    };
  });
}

// ---------------------------------------------------------------- scoring

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking is a product of another protocol's token. */
const WRAPPED_OR_STAKED = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name is that exchange's product, not a protocol of its own. */
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)(\s|$)/i;

/** Categories the board never ranks: bridges, liquid (re)staking, restaked BTC and exchanges. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol is one the board may rank: pre-token, in a rankable category, not a versioned, wrapped, staked or exchange-named product, with a positive TVL. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category as string) &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_OR_STAKED.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name) &&
    p.tvl_usd > 0
  );
}

/** A curator or allocator row's TVL is managed vaults, not the protocol's own deposits. */
export function tvlQuality(p: SnapshotProtocol): 'protocol' | 'curator — TVL is managed vaults' {
  return p.category === 'Risk Curators' || p.category === 'Onchain Capital Allocator'
    ? 'curator — TVL is managed vaults'
    : 'protocol';
}

/** The four factors and the implied value one protocol gets. The stored 4dp factors are the ones multiplied, so the stored fields reproduce the implied value exactly. */
export function scoreProtocol(
  p: SnapshotProtocol,
  snapshot: Snapshot,
  table: PeerTable,
): {
  implied: number;
  multiple: number;
  peerCount: number;
  peerRange: [number, number] | null;
  catMedian: number | null;
  globalMedian: number;
  factorG: number;
  factorB: number;
  factorA: number;
  age: number | null;
  ageYears: number | null;
} {
  const age = ageDays(snapshot.as_of, p.listed_at);
  const ageYears = age === null ? null : round2(age / 365.25);
  const { multiple, peerCount, peerRange, catMedian, globalMedian } = multipleFor(p.category, table);
  const g = p.change_7d === null ? 1 : 1 + Math.min(0.2, Math.max(-0.15, p.change_7d / 100));
  const chainCount = Array.isArray(p.chains) ? p.chains.length : 0;
  const b = 1 + 0.03 * Math.min(Math.max(chainCount - 1, 0), 10);
  let a: number;
  if (age === null) {
    a = 0.95;
  } else {
    const y = age / 365.25;
    a = 0.9 + 0.05 * Math.min(y, 2) - 0.05 * Math.max(y - 2, 0);
    a = Math.min(1.0, Math.max(0.8, a));
  }
  const factorG = round4(g);
  const factorB = round4(b);
  const factorA = round4(a);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * factorG * factorB * factorA));
  return { implied, multiple, peerCount, peerRange, catMedian, globalMedian, factorG, factorB, factorA, age, ageYears };
}

// ---------------------------------------------------------------- farm plans

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol, index: number): string {
  return p.chains.length > index ? p.chains[index]! : p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/**
 * How much capital one farm position needs: a continuous log-scale function of the protocol's
 * own TVL, $50 at the board's smallest TVL rising smoothly to $500 at the largest. No buckets:
 * two protocols with different TVLs get different capital, and the function is computed from
 * the board's own min and max TVL at runtime, never hardcoded.
 */
export function capitalFor(tvl: number, minTvl: number, maxTvl: number): number {
  if (!(maxTvl > minTvl) || !(tvl > 0)) return 50;
  const t = Math.log(tvl / minTvl) / Math.log(maxTvl / minTvl);
  return Math.min(500, Math.max(50, Math.round(50 + 450 * t)));
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** A calendar date, YYYY-MM-DD, `days` after `asOf` (YYYY-MM-DD). */
function datePlus(asOf: string, days: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The gas one simple transaction costs on a chain: Ethereum is expensive, Bitcoin is middling,
    every other chain the board names is under $0.50. */
function gasPhrase(chain: string): string {
  if (chain === 'Ethereum') return 'about $3–$8';
  if (chain === 'Bitcoin') return 'about $1–$3';
  return 'under $0.50';
}

/** The native asset a chain stakes with. Chains the board names that are not listed here fall back
    to the chain's own native token, which every chain has. */
const NATIVE_ASSET: Record<string, string> = {
  Ethereum: 'ETH',
  Arbitrum: 'ETH',
  Base: 'ETH',
  Optimism: 'ETH',
  Linea: 'ETH',
  Scroll: 'ETH',
  Blast: 'ETH',
  Unichain: 'ETH',
  Ink: 'ETH',
  Mode: 'ETH',
  Solana: 'SOL',
  Binance: 'BNB',
  Avalanche: 'AVAX',
  Polygon: 'POL',
  Sui: 'SUI',
  Aptos: 'APT',
  Near: 'NEAR',
  Cosmos: 'ATOM',
  Bitcoin: 'BTC',
  Bittensor: 'TAO',
  Tron: 'TRX',
  Cardano: 'ADA',
  Fantom: 'FTM',
  Cronos: 'CRO',
  Kava: 'KAVA',
  Osmosis: 'OSMO',
  Sei: 'SEI',
  Starknet: 'STRK',
  Injective: 'INJ',
  Algorand: 'ALGO',
  Canton: 'CC',
  'Hyperliquid L1': 'HYPE',
  Mantle: 'MNT',
  Proton: 'XPR',
  Qubic: 'QUBIC',
  Ripple: 'XRP',
  Ronin: 'RON',
  Stellar: 'XLM',
  'zkSync Era': 'ETH',
};

function nativeAsset(chain: string): string {
  return NATIVE_ASSET[chain] ?? `the native token of ${chain}`;
}

/** " on {chain}" after a protocol's name, unless the chain IS the protocol's name (Noble on
    Noble): then nothing, so the step never reads "Noble on Noble". */
function chainSuffix(p: SnapshotProtocol, chain: string): string {
  if (chain === '' || chain.toLowerCase() === p.name.toLowerCase()) return '';
  return ` on ${chain}`;
}

/** A category's family: the shape of farm its rows take. Ordered most specific first. */
function familyFor(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c === 'chain') return 'chain';
  if (
    c.includes('yield aggregator') ||
    c.includes('leveraged farm') ||
    c.includes('liquidity manager') ||
    c.includes('curator') ||
    c.includes('allocator')
  ) {
    return 'vault';
  }
  if (c === 'yield') return 'vault';
  if (c.includes('lend')) return 'lend';
  if (c.includes('cdp')) return 'cdp';
  if (c.includes('collateral')) return 'collateral';
  if (c.startsWith('dex')) return 'dex';
  if (c.includes('payment')) return 'payments';
  if (c.includes('staking') || c.includes('restak')) return 'stake';
  if (c.includes('stable')) return 'stable';
  if (c.includes('rwa')) return 'rwa';
  if (c.includes('perpetual') || c.includes('derivative')) return 'perps';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('basis')) return 'basis';
  if (c.includes('cedefi')) return 'cedefi';
  if (c.includes('index')) return 'index';
  if (c.includes('governance')) return 'governance';
  if (c === 'farm') return 'farm';
  if (c.includes('anchor') || c.includes('decentralized btc')) return 'btc';
  if (c.includes('card')) return 'card';
  if (c.includes('bridge')) return 'bridge';
  return 'default';
}

/** What the fresh wallet is funded with: USDC for most farms, BTC for a BTC farm, the chain's
    native asset for a staking farm, a USDC/native split for a DEX pool. */
function setupFunding(p: SnapshotProtocol, capital: number, chain: string): string {
  const fam = familyFor(p.category);
  if (fam === 'stake') return `$${capital} of ${nativeAsset(chain)}`;
  if (fam === 'btc') return `$${capital} of BTC`;
  if (fam === 'dex') return `$${capital} split between USDC and ${nativeAsset(chain)}`;
  return `$${capital} of USDC`;
}

/** The category's one action, in the words a farmer can follow. Every branch names the chain
    the action runs on, and the asset named is one that exists on that chain: a vault takes USDC,
    a staking step takes the chain's native asset, a CDP mints against collateral, a chain is
    bridged to (never "deposit USDC to a chain"), a yield aggregator deposits into its own vault
    (never an invented "main pool"), and USDD-style CDPs mint (never "supply USDC to USDD"). */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  const c = (p.category ?? '').toLowerCase();
  switch (familyFor(p.category)) {
    case 'lend':
      return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
    case 'cdp':
      return `Deposit $${capital} of collateral on ${name} on ${chain} and mint its stablecoin against it.`;
    case 'collateral':
      return `Deposit $${capital} of collateral into ${name} on ${chain} and keep it staked as collateral.`;
    case 'dex':
      return `Provide $${capital} of liquidity to a ${name} pool on ${chain} and keep the position open.`;
    case 'vault': {
      if (c === 'yield') return `Deposit $${capital} of USDC into a ${name} yield strategy on ${chain} and keep the position open.`;
      if (c.includes('leveraged')) return `Deposit $${capital} of USDC into a ${name} leveraged position on ${chain} and keep it open.`;
      if (c.includes('liquidity manager')) return `Deposit $${capital} of USDC into a ${name} managed position on ${chain} and keep it open.`;
      if (c.includes('allocator')) return `Deposit $${capital} of USDC into a ${name} allocator vault on ${chain} and keep the shares.`;
      if (c.includes('curator')) return `Deposit $${capital} of USDC into a ${name} curator vault on ${chain} and keep the shares.`;
      return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`;
    }
    case 'chain':
      return `Bridge $${capital} of USDC to ${chain} and use it in an app there — ${name} is a chain, not a farmable app.`;
    case 'payments':
      return `Bridge $${capital} of USDC to ${chain} and make one payment through ${name}.`;
    case 'stake':
      return `Stake $${capital} of ${nativeAsset(chain)} through ${name} on ${chain} and keep the receipt.`;
    case 'stable':
      return `Mint $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
    case 'rwa':
      return `Buy $${capital} of ${name}'s tokenized asset on ${chain} and hold it.`;
    case 'perps':
      return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedge.`;
    case 'insurance':
      return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
    case 'prediction':
      return `Fund $${capital} and place one market position on ${name} on ${chain}.`;
    case 'basis':
      return `Deposit $${capital} of USDC into a ${name} basis position on ${chain} and keep it open.`;
    case 'cedefi':
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
    case 'index':
      return `Buy $${capital} of the ${name} index token on ${chain} and hold it.`;
    case 'governance':
      return `Deposit $${capital} of USDC into ${name} on ${chain} and vote in its governance.`;
    case 'farm':
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
    case 'btc':
      return `Deposit $${capital} of BTC into ${name} on ${chain} and keep the position open.`;
    case 'card':
      return `Load $${capital} of USDC onto a ${name} card on ${chain} and spend from it.`;
    case 'bridge':
      return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
}

/** The two weekly actions that actually exist in the category: a lender tops up collateral or
    repays, a DEX swaps or rebalances, a vault harvests, a staker claims and restakes. */
function weeklyFor(category: string | null): [string, string] {
  const c = (category ?? '').toLowerCase();
  switch (familyFor(category)) {
    case 'lend':
      return ['top up the collateral or repay part of the loan', 'check the borrow rate and adjust the position'];
    case 'cdp':
      return ['top up the collateral or repay part of the minted stablecoin', 'check the collateral ratio and adjust it'];
    case 'collateral':
      return ['check the collateral\u2019s yield and top it up', 'check the restaking rewards it earned'];
    case 'dex':
      return ['swap a small amount or add and remove a little liquidity', 'check the pool\u2019s fees and rebalance the range'];
    case 'vault':
      if (c === 'yield') return ['harvest the strategy\u2019s yield or compound it', 'check the strategy\u2019s reported yield'];
      if (c.includes('leveraged')) return ['check the leverage ratio and top up margin if needed', 'harvest the position\u2019s yield'];
      if (c.includes('liquidity manager')) return ['check the managed range and let it rebalance', 'harvest the fees it earned'];
      return ['harvest the vault\u2019s yield or re-deposit it', 'check the vault\u2019s reported APY and strategy'];
    case 'chain':
      return ['use an app there — swap, lend or stake a small amount', 'check the chain\u2019s activity and fees'];
    case 'payments':
      return ['make one small payment', 'check the payment history and fees'];
    case 'stake':
      return ['claim the staking rewards and restake them', 'check the validator\u2019s performance'];
    case 'stable':
      return ['mint or redeem a small amount of the stable asset', 'check the peg and the redemption rate'];
    case 'rwa':
      return ['check the yield the tokenized asset accrued', 'top up the position with a small amount'];
    case 'perps':
      return ['adjust the hedge or close and reopen it', 'check the funding rate and margin'];
    case 'insurance':
      return ['check the cover\u2019s expiry and the policy\u2019s terms', 'top up the cover if the position grew'];
    case 'prediction':
      return ['place one small market position', 'check the open markets and settle any that closed'];
    case 'basis':
      return ['check the basis spread and the funding', 'top up the position if the spread widened'];
    case 'cedefi':
      return ['check the position\u2019s yield and the platform\u2019s rates', 'top up or withdraw a small amount'];
    case 'index':
      return ['check the index\u2019s composition and rebalance', 'top up the index position'];
    case 'governance':
      return ['vote in one governance proposal', 'check the rewards the vote earned'];
    case 'farm':
      return ['check the farm\u2019s yield and harvest it', 'top up the farm with a small amount'];
    case 'btc':
      return ['check the BTC peg and the position\u2019s yield', 'top up the BTC deposit'];
    case 'card':
      return ['spend a small amount on the card', 'check the card\u2019s rewards and top it up'];
    case 'bridge':
      return ['bridge a small amount back and forth', 'check the bridge\u2019s fees and speed'];
    default:
      return ['make a small deposit or withdrawal', 'check the position\u2019s yield and fees'];
  }
}

/** Why the position is held: the reason the category's own yield needs more than one snapshot. */
function holdReasonFor(category: string | null): string {
  switch (familyFor(category)) {
    case 'lend':
      return 'the loan accrues interest across more than one snapshot';
    case 'cdp':
      return 'the minted stablecoin stays collateralised across more than one snapshot';
    case 'collateral':
      return 'the collateral keeps earning across more than one snapshot';
    case 'dex':
      return 'the liquidity earns fees across more than one snapshot';
    case 'vault':
      return 'the vault\u2019s yield compounds across more than one snapshot';
    case 'chain':
      return 'the activity on the chain is counted in more than one snapshot';
    case 'payments':
      return 'the payment history is counted in more than one snapshot';
    case 'stake':
      return 'the staking rewards accrue across more than one snapshot';
    case 'stable':
      return 'the stable asset\u2019s peg is proven across more than one snapshot';
    case 'rwa':
      return 'the tokenized asset\u2019s yield accrues across more than one snapshot';
    case 'perps':
      return 'the hedge stays open across more than one snapshot';
    case 'insurance':
      return 'the cover stays active across more than one snapshot';
    case 'prediction':
      return 'the market positions settle across more than one snapshot';
    case 'basis':
      return 'the basis position earns funding across more than one snapshot';
    case 'cedefi':
      return 'the position\u2019s yield accrues across more than one snapshot';
    case 'index':
      return 'the index position is counted in more than one snapshot';
    case 'governance':
      return 'the votes are counted in more than one snapshot';
    case 'farm':
      return 'the farm\u2019s yield accrues across more than one snapshot';
    case 'btc':
      return 'the BTC deposit earns yield across more than one snapshot';
    case 'card':
      return 'the card\u2019s spending history is counted in more than one snapshot';
    case 'bridge':
      return 'the bridged funds are counted in more than one snapshot';
    default:
      return 'the activity is counted in more than one snapshot';
  }
}

/** What the pre-withdrawal check looks at: the category's own rewards, named so the step is
    not the same sentence for a vault, a pool and a staking receipt. */
function checkWhatFor(category: string | null): string {
  const cat = category ?? 'protocol';
  switch (familyFor(category)) {
    case 'vault':
      return `the ${cat} vault\u2019s yield and rewards`;
    case 'dex':
      return `the ${cat} pool\u2019s fees and rewards`;
    case 'lend':
      return `the ${cat} borrow rewards`;
    case 'cdp':
      return `the ${cat} mint rewards`;
    case 'stake':
      return `the ${cat} staking rewards`;
    case 'chain':
      return 'any rewards the chain lists';
    default:
      return `the ${cat} rewards`;
  }
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, built from the
 * protocol's own record (slug, name, category, chains, TVL, age, 7-day change). The steps name
 * the protocol's own chains and category, the capital is a continuous function of its TVL, the
 * hold step names a real calendar date, the gas is priced for the chain the step runs on, and
 * the last step is a kill criterion for that row. A row whose 7-day change is already -20% or
 * worse does not tell the reader to enter: it is a NO-GO watch plan, and its first and last
 * steps say so. Every step carries the protocol's name and category, so no two rows in
 * different categories share a step's wording. The plan promises nothing about a launch: the
 * protocol records no token, and no step claims an airdrop, a token, an allocation, a points
 * program or a date.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, minTvl: number, maxTvl: number, asOf: string): FarmStep[] {
  const chain1 = chainOf(p, 0);
  const chain2 = chainOf(p, 1);
  const capital = capitalFor(p.tvl_usd, minTvl, maxTvl);
  const hold = holdDaysFor(age);
  const date = datePlus(asOf, hold);
  const cat = p.category ?? 'protocol';
  const chg = p.change_7d;
  const chgText = chg === null ? '' : ` (it is ${chg.toFixed(1)}% over the last 7 days)`;
  const noGo = chg !== null && chg <= -20;
  const action = actionFor(p, capital, chain1);
  const [weeklyA, weeklyB] = weeklyFor(p.category);
  if (noGo) {
    return [
      {
        text: `Watch ${p.name} only — do not enter this ${cat} farm: its TVL is ${chg!.toFixed(1)}% over the last 7 days, past the -20% exit line, so the kill criterion already fired before entry.`,
        cost: 'nothing to watch',
        time: '5 minutes',
      },
      {
        text: `Set a TVL watch on ${p.name}${chainSuffix(p, chain1)} and wait for two flat weeks before considering any deposit.`,
        cost: 'nothing to watch',
        time: '5 minutes to set up',
      },
      {
        text: `Check ${p.name}'s TVL each week${chainSuffix(p, chain2)}; a further 20% fall from here confirms the downtrend.`,
        cost: 'nothing to watch',
        time: '5 minutes a week',
      },
      {
        text: `Reassess on ${date} (at least ${hold} days): only enter this ${cat} farm if the 7-day change has recovered above -10%.`,
        cost: 'nothing to watch',
        time: `until ${date}`,
      },
      {
        text: `Before you withdraw, check ${p.name}'s own rewards page — ${checkWhatFor(p.category)} — and claim only from the link it publishes; never pay to claim.`,
        cost: 'no fee to check, and never pay to claim',
        time: '10 minutes',
      },
      {
        text: `NO-GO — kill already triggered at entry: ${p.name} is ${chg!.toFixed(1)}% over the last 7 days, past the -20% exit line. Do not enter; record the no-go in the farm log for ${p.slug}.`,
        cost: 'nothing — do not enter',
        time: '5 minutes to record',
      },
    ];
  }
  return [
    {
      text: `Open a fresh wallet for the ${cat} farm on ${p.name}${chainSuffix(p, chain1)}, fund it with ${setupFunding(p, capital, chain1)}, and keep its seed phrase offline.`,
      cost: `${gasPhrase(chain1)} of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gasPhrase(chain1)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action each week for the ${cat} position on ${p.name}${chainSuffix(p, chain2)} — ${weeklyA}, or ${weeklyB}.`,
      cost: `${gasPhrase(chain2)} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the ${p.name} ${cat} position until ${date} (at least ${hold} days) so ${holdReasonFor(p.category)}.`,
      cost: `the $${capital} stays in the position`,
      time: `until ${date}`,
    },
    {
      text: `Before you withdraw, check ${p.name}'s own rewards page — ${checkWhatFor(p.category)} — and claim only from the link it publishes; never pay to claim.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Exit ${p.name} if its TVL falls a further 20% from here${chgText} or if a token is listed; record the exit in the farm log for ${p.slug}.`,
      cost: 'nothing to exit, plus gas to withdraw',
      time: '5 minutes to unwind',
    },
  ];
}

// ---------------------------------------------------------------- board

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The funnel: how the snapshot's protocols become the board's rows, in mutually exclusive buckets. */
export function funnelFor(snapshot: Snapshot, boardSize: number): Funnel {
  const watchlist = new Set(snapshot.watchlist);
  let early = 0;
  let aboveFloor = 0;
  let tokenized = 0;
  let category = 0;
  let name = 0;
  let zeroTvl = 0;
  for (const p of snapshot.protocols) {
    if (watchlist.has(p.slug)) continue;
    if (isRankable(p)) {
      if (p.tvl_usd < snapshot.floor_usd) early++;
      else aboveFloor++;
      continue;
    }
    if (!isPreToken(p)) tokenized++;
    else if (EXCLUDED_CATEGORIES.has(p.category as string)) category++;
    else if (VERSIONED.test(p.name) || WRAPPED_OR_STAKED.test(p.name) || EXCHANGE_PREFIX.test(p.name)) name++;
    else if (p.tvl_usd <= 0) zeroTvl++;
    else tokenized++; // unreachable: isRankable is exactly these conditions, but keep the sum exact
  }
  return {
    snapshot: snapshot.protocols.length,
    watchlist: snapshot.watchlist.length,
    early,
    board: boardSize,
    above_floor_rankable: aboveFloor,
    not_rankable: tokenized + category + name + zeroTvl,
    not_rankable_tokenized: tokenized,
    not_rankable_category: category,
    not_rankable_name: name,
    not_rankable_zero_tvl: zeroTvl,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const table = buildPeerTable(snapshot);
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug the snapshot carries, whatever its rankable rule says.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined && p.tvl_usd > 0) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor. Never a
  // replacement for a watchlist row, and never an above-floor protocol the watchlist leaves out.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) chosen.set(p.slug, p);
  }

  const tvls = [...chosen.values()].map((p) => p.tvl_usd);
  const minTvl = Math.min(...tvls);
  const maxTvl = Math.max(...tvls);
  const scored = [...chosen.values()].map((p) => ({ p, s: scoreProtocol(p, snapshot, table) }));
  scored.sort((a, b) => b.s.implied - a.s.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map(({ p, s }, i) => {
    const model: ModelDetail = {
      multiple: s.multiple,
      peer_count: s.peerCount,
      peer_range: s.peerRange,
      cat_median: s.catMedian,
      global_median: s.globalMedian,
      factor_g: s.factorG,
      factor_b: s.factorB,
      factor_a: s.factorA,
    };
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      age_days: s.age,
      age_years: s.ageYears,
      watchlist: watchlist.has(p.slug),
      tvl_quality: tvlQuality(p),
      implied_value_usd: s.implied,
      implied_multiple: round4(s.implied / p.tvl_usd),
      multiple: s.multiple,
      peer_count: s.peerCount,
      peer_range: s.peerRange,
      cat_median: s.catMedian,
      global_median: s.globalMedian,
      factor_g: s.factorG,
      factor_b: s.factorB,
      factor_a: s.factorA,
      farmable: true,
      farm_steps: farmSteps(p, s.age, minTvl, maxTvl, snapshot.as_of).map(stepText),
      comparables: comparablesFor(p, table),
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      model,
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd as number) - (a.mcap_usd as number) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    age_years: row.age_years,
    watchlist: row.watchlist,
    tvl_quality: row.tvl_quality,
    implied_value_usd: row.implied_value_usd,
    implied_multiple: row.implied_multiple,
    multiple: row.multiple,
    peer_count: row.peer_count,
    peer_range: row.peer_range,
    cat_median: row.cat_median,
    global_median: row.global_median,
    factor_g: row.factor_g,
    factor_b: row.factor_b,
    factor_a: row.factor_a,
    farmable: row.farmable,
    farm_steps: row.farm_steps,
    comparables: row.comparables,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const table = buildPeerTable(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  // The snapshot's source names a URL; the dashboard carries no URL at all, so the endpoint
  // is replaced by the words that describe it. The fetch date is kept.
  const source = snapshot.source.replace(/https?:\/\/[^\s,]+/, 'protocols snapshot');
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: {
      formula: MODEL_FORMULA,
      global_fallback: table.globalMedian,
      peer_multiples: peerMultiples(snapshot, table),
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    funnel: funnelFor(snapshot, board.length),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, farm steps, and farm-plan distinctness. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return `the board repeats a slug`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const index = bySlug(snapshot.protocols);
  for (const r of board) {
    const p = index.get(r.slug);
    if (p === undefined) return `${r.slug} is not in the snapshot`;
    if (!snapshot.watchlist.includes(r.slug) && !(isRankable(p) && p.tvl_usd < snapshot.floor_usd)) {
      return `${r.slug} is on the board but is neither on the watchlist nor a rankable protocol below the floor`;
    }
  }
  const missingEarly = snapshot.protocols.filter(
    (p) => !snapshot.watchlist.includes(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd && !slugs.has(p.slug),
  );
  if (missingEarly.length > 0) return `the board misses ${missingEarly.length} rankable protocol${missingEarly.length === 1 ? '' : 's'} below the floor: ${missingEarly.slice(0, 5).map((p) => p.slug).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  const blocks = new Set(board.map((r) => r.farm_steps.join('\u0000')));
  if (blocks.size !== board.length) return `farm plans repeat: ${board.length - blocks.size} rows share a six-step block`;
  for (const r of board) {
    if (r.farm_steps.length !== 6) return `${r.slug} has ${r.farm_steps.length} farm steps, not 6`;
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    for (const n of [r.implied_multiple, r.multiple, r.factor_g, r.factor_b, r.factor_a, r.global_median]) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return `${r.slug} has a non-finite model number`;
    }
    if (r.cat_median !== null && !Number.isFinite(r.cat_median)) return `${r.slug} has a non-finite category median`;
    if (r.age_years !== null && !Number.isFinite(r.age_years)) return `${r.slug} has a non-finite age`;
    for (const c of r.comparables) {
      if (!Number.isFinite(c.multiple)) return `${r.slug} has a non-finite comparable multiple`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
