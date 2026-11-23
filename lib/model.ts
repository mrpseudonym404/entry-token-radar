// The token radar's model (radar-2): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) plus every
// rankable pre-token protocol below the watchlist floor: the early rows the radar exists to find.
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, never from a hand-written list of names:
//
//   Implied = TVL x M_cat x G x B x A x D
//
//   M_cat  winsorized median mcap/TVL of the tokenized peers in the SAME category (peers: mcap not
//          null and TVL >= $1M; each ratio clipped to [0.02, 3.0]). Fewer than 3 peers in the
//          category: the global fallback, the winsorized median over ALL tokenized peers with
//          TVL >= $1M, rounded to two decimals (0.17 on this snapshot).
//   G      1 + clamp(change_7d / 100, -0.20, +0.30); no 7-day change recorded: 1.00.
//   B      1 + 0.05 x min(max(chains - 1, 0), 10); one chain: 1.00, eleven or more: 1.50.
//   A      0.70 + 0.10 x min(age_years, 3); age_years = (as_of - listed_at) / 365.25;
//          no listing date recorded: 0.80.
//   D      0.50, a flat launch-uncertainty haircut, the same for every row.
//
// The implied value is rounded to a whole dollar (minimum 1) and the board is sorted by implied
// value descending, ties broken by slug ascending. Curator and allocator rows keep their place on
// the board; their TVL is flagged as managed vaults, not dropped.
//
// Farm plans are generated from each row's own category, chains, TVL and age, never written per
// name. The plan never claims a launch: it says a protocol records no token, and no step promises
// an airdrop, a token, an allocation or a date.

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
export const MODEL_VERSION = 'radar-2';

/** The model's formula, as the dashboard states it. */
export const MODEL_FORMULA = 'Implied = TVL x M_cat x G x B x A x D';

/** The flat launch-uncertainty haircut D, the same for every row. */
export const HAIRCUT_D = 0.5;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A peer must clear this TVL to count toward a category multiple. */
export const PEER_MIN_TVL = 1_000_000;

/** The winsor clip on a peer's mcap/TVL ratio. */
export const CLIP_LO = 0.02;
export const CLIP_HI = 3.0;

/** A category needs this many peers before its own median is used instead of the fallback. */
export const PEER_MIN_COUNT = 3;

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
  /** True when this peer's clipped ratio is the category median. */
  is_median_setter: boolean;
}

/** The model's per-row detail, as board.json nests it. */
export interface ModelDetail {
  multiple: number;
  peer_count: number;
  peer_range: [number, number] | null;
  factor_g: number;
  factor_b: number;
  factor_a: number;
  factor_d: number;
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
  /** The category multiple M_cat actually applied, 4dp. */
  multiple: number;
  peer_count: number;
  /** [min, max] of the category peers' clipped ratios, 4dp; null when the fallback applies. */
  peer_range: [number, number] | null;
  factor_g: number;
  factor_b: number;
  factor_a: number;
  factor_d: number;
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
  /** The multiple applied for this category, 4dp (the fallback when n < 3). */
  median: number;
  /** [min, max] of the category peers' clipped ratios, 4dp; null when the fallback applies. */
  range: [number, number] | null;
}

/** The model block data.js carries. */
export interface RadarModel {
  formula: string;
  global_fallback: number;
  haircut: number;
  peer_multiples: Record<string, PeerMultiple>;
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

/** The peer table a snapshot yields: every category's peers plus the global fallback. */
interface PeerTable {
  byCategory: Map<string, PeerSet>;
  /** The global fallback: the winsorized median over all tokenized peers, to two decimals. */
  globalFallback: number;
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
  return { byCategory, globalFallback: globalMedian === null ? 0.17 : round2(globalMedian) };
}

/** The multiple a category gets: its own median (4dp) with 3+ peers, else the global fallback. */
function multipleFor(
  category: string | null,
  table: PeerTable,
): { multiple: number; peerCount: number; peerRange: [number, number] | null } {
  const set = category === null ? undefined : table.byCategory.get(category);
  const n = set === undefined ? 0 : set.ratios.length;
  if (set !== undefined && n >= PEER_MIN_COUNT && set.medianRaw !== null) {
    const sorted = [...set.ratios].sort((a, b) => a - b);
    return { multiple: round4(set.medianRaw), peerCount: n, peerRange: [round4(sorted[0]!), round4(sorted[sorted.length - 1]!)] };
  }
  return { multiple: table.globalFallback, peerCount: n, peerRange: null };
}

/** The model's peer-multiples table: every category the snapshot names, in category order. */
function peerMultiples(snapshot: Snapshot, table: PeerTable): Record<string, PeerMultiple> {
  const out: Record<string, PeerMultiple> = {};
  const categories = [...new Set(snapshot.protocols.map((p) => p.category).filter((c): c is string => c !== null))].sort();
  for (const c of categories) {
    const m = multipleFor(c, table);
    out[c] = { n: m.peerCount, median: m.multiple, range: m.peerRange };
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
  factorG: number;
  factorB: number;
  factorA: number;
  factorD: number;
  age: number | null;
  ageYears: number | null;
} {
  const age = ageDays(snapshot.as_of, p.listed_at);
  const ageYears = age === null ? null : round2(age / 365.25);
  const { multiple, peerCount, peerRange } = multipleFor(p.category, table);
  const g = p.change_7d === null ? 1 : 1 + Math.min(0.3, Math.max(-0.2, p.change_7d / 100));
  const chainCount = Array.isArray(p.chains) ? p.chains.length : 0;
  const b = 1 + 0.05 * Math.min(Math.max(chainCount - 1, 0), 10);
  const a = age === null ? 0.8 : 0.7 + 0.1 * Math.min(age / 365.25, 3);
  const d = HAIRCUT_D;
  const factorG = round4(g);
  const factorB = round4(b);
  const factorA = round4(a);
  const factorD = round4(d);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * factorG * factorB * factorA * factorD));
  return { implied, multiple, peerCount, peerRange, factorG, factorB, factorA, factorD, age, ageYears };
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
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.startsWith('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * It promises nothing about a launch: the protocol records no token, and no step claims an airdrop,
 * a token, an allocation, a points program or a date.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, check the protocol's own points or rewards page if it has one, and claim only from the link it publishes, never pay to claim.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

// ---------------------------------------------------------------- board

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
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

  const scored = [...chosen.values()].map((p) => ({ p, s: scoreProtocol(p, snapshot, table) }));
  scored.sort((a, b) => b.s.implied - a.s.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map(({ p, s }, i) => {
    const model: ModelDetail = {
      multiple: s.multiple,
      peer_count: s.peerCount,
      peer_range: s.peerRange,
      factor_g: s.factorG,
      factor_b: s.factorB,
      factor_a: s.factorA,
      factor_d: s.factorD,
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
      factor_g: s.factorG,
      factor_b: s.factorB,
      factor_a: s.factorA,
      factor_d: s.factorD,
      farmable: true,
      farm_steps: farmSteps(p, s.age).map(stepText),
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
    factor_g: row.factor_g,
    factor_b: row.factor_b,
    factor_a: row.factor_a,
    factor_d: row.factor_d,
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
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: {
      formula: MODEL_FORMULA,
      global_fallback: table.globalFallback,
      haircut: HAIRCUT_D,
      peer_multiples: peerMultiples(snapshot, table),
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
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

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
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
  for (const r of board) {
    if (r.farm_steps.length !== 6) return `${r.slug} has ${r.farm_steps.length} farm steps, not 6`;
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    for (const n of [r.implied_multiple, r.multiple, r.factor_g, r.factor_b, r.factor_a, r.factor_d]) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return `${r.slug} has a non-finite model number`;
    }
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
