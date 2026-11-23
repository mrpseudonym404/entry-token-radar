"use strict";
var R = (typeof window !== "undefined" && window.RADAR) || { rows: [], live: [], as_of: "2026-11-14", model_version: "radar-4", floor_usd: 50000000, watchlist_size: 0, board_size: 0, early_size: 0, funnel: null, model: { global_fallback: 0.1689 } };
var rows = Array.isArray(R.rows) ? R.rows : [];
var live = Array.isArray(R.live) ? R.live : [];
var F = R.funnel || null;
var GF = (R.model && R.model.global_fallback != null) ? R.model.global_fallback : 0.1689;
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
var cfmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
function money(v) { if (v == null || isNaN(v)) return "$0"; var a = Math.abs(v); if (a < 1000) return "$" + Math.round(v); return "$" + cfmt.format(v); }
function pct(v) { if (v == null || isNaN(v)) return "—"; return (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
function mult(v) { if (v == null || isNaN(v)) return "—"; return v.toFixed(2) + "x"; }
function fnum(v, d) { if (v == null || isNaN(v)) return "—"; return Number(v).toFixed(d == null ? 2 : d); }
function impliedOf(r) { return Math.round((r.tvl_usd || 0) * (r.multiple || 0) * (r.factor_g || 1) * (r.factor_b || 1) * (r.factor_a || 1)); }
rows.forEach(function (r) { r._imp = impliedOf(r); });
var top1 = rows.reduce(function (a, b) { return (b._imp || 0) > (a._imp || 0) ? b : a; }, rows[0] || null);
var top1Imp = top1 ? top1._imp : 1;
var totalImp = rows.reduce(function (s, r) { return s + (r._imp || 0); }, 0);
var farmN = rows.filter(function (r) { return r.farmable; }).length;
var state = { q: "", cat: "", chain: "", tvl: "", farm: false, sort: "implied-desc", page: 1 };
var PER = 25;
function catOf(r) { return r.category || "Uncategorized"; }
function chainsHtml(ch) { if (!ch || !ch.length) return '<span class="mut">—</span>'; var s = ch.slice(0, 3).join(", "); return esc(s) + (ch.length > 3 ? ' <span class="mut">+' + (ch.length - 3) + "</span>" : ""); }
function tvlOk(r) { var t = r.tvl_usd || 0, k = state.tvl; if (!k) return true; if (k === "1b") return t >= 1e9; if (k === "500m") return t >= 5e8 && t < 1e9; if (k === "100m") return t >= 1e8 && t < 5e8; return t < 1e8; }
function filtered() {
  var q = state.q.trim().toLowerCase();
  var out = rows.filter(function (r) {
    if (state.cat && catOf(r) !== state.cat) return false;
    if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
    if (state.farm && !r.farmable) return false;
    if (!tvlOk(r)) return false;
    if (q && (String(r.name || "") + " " + String(r.slug || "") + " " + catOf(r)).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var k = state.sort;
  out.sort(function (a, b) {
    if (k === "implied-asc") return a._imp - b._imp;
    if (k === "tvl-desc") return (b.tvl_usd || 0) - (a.tvl_usd || 0);
    if (k === "tvl-asc") return (a.tvl_usd || 0) - (b.tvl_usd || 0);
    if (k === "mult-desc") return (b.multiple || 0) - (a.multiple || 0);
    if (k === "mult-asc") return (a.multiple || 0) - (b.multiple || 0);
    if (k === "chg-desc") return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d);
    if (k === "chg-asc") return (a.change_7d == null ? 1e9 : a.change_7d) - (b.change_7d == null ? 1e9 : b.change_7d);
    if (k === "name-asc") return String(a.name).localeCompare(String(b.name));
    if (k === "name-desc") return String(b.name).localeCompare(String(a.name));
    return b._imp - a._imp;
  });
  return out;
}
function isActive() { return !!(state.q || state.cat || state.chain || state.tvl || state.farm || state.sort !== "implied-desc"); }
function renderFunnel() {
  if (!F) return;
  var el = $("funnel");
  el.textContent = F.snapshot + " in snapshot → " + F.watchlist + " watchlist + " + F.early + " below the $" + Math.round((R.floor_usd || 50000000) / 1e6) + "M floor = " + F.board + " ranked · " + F.above_floor_rankable + " above floor not on board · " + F.not_rankable + " not rankable (" + F.not_rankable_tokenized + " tokenized, " + F.not_rankable_category + " excluded category, " + F.not_rankable_name + " by name).";
}
function renderKpis() {
  $("snapDate").textContent = R.as_of || "2026-11-14";
  $("topCount").textContent = rows.length + " ranked";
  $("kpiTotal").textContent = money(totalImp);
  $("kpiCount").textContent = String(rows.length || R.board_size || 0);
  $("kpiCountS").textContent = (R.watchlist_size || 0) + " on the watchlist · " + (R.early_size || 0) + " below the floor";
  $("kpiFarm").textContent = String(farmN);
  if (top1) { $("kpiTop").textContent = top1.name; $("kpiTopV").textContent = money(top1._imp) + " implied"; }
}
function renderHero() {
  if (!top1) return;
  $("heroName").textContent = top1.name;
  $("heroMeta").textContent = catOf(top1) + " · TVL " + money(top1.tvl_usd) + " · M_cat " + mult(top1.multiple) + " · " + (top1.chains || []).slice(0, 3).join(", ");
  $("heroVal").textContent = money(top1._imp);
  var top5 = rows.slice().sort(function (a, b) { return b._imp - a._imp; }).slice(0, 5);
  $("heroBars").innerHTML = top5.map(function (r, i) {
    var w = Math.max(2, Math.round((r._imp / top1Imp) * 100));
    return '<div class="hbar"><span class="n">' + (i + 1) + ". " + esc(r.name) + '</span><span class="tr"><span class="fl" style="width:' + w + '%"></span></span><span class="v">' + money(r._imp) + "</span></div>";
  }).join("");
}
function renderLive() {
  if (!live.length) return;
  var top = live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); }).slice(0, 8);
  $("liveSec").hidden = false;
  $("liveRow").innerHTML = top.map(function (r) {
    return '<div class="live-chip"><b>' + esc(r.name) + "</b><span>" + money(r.mcap_usd) + " mcap · " + money(r.tvl_usd) + " TVL</span></div>";
  }).join("");
}
function renderCats() {
  var m = {};
  rows.forEach(function (r) { var c = catOf(r); m[c] = (m[c] || 0) + 1; });
  var sel = $("cat"), cur = state.cat;
  sel.innerHTML = '<option value="">All categories</option>' + Object.keys(m).sort().map(function (c) {
    return '<option value="' + esc(c) + '"' + (c === cur ? " selected" : "") + ">" + esc(c) + " (" + m[c] + ")</option>";
  }).join("");
}
function renderChains() {
  var m = {};
  rows.forEach(function (r) { (r.chains || []).forEach(function (c) { m[c] = (m[c] || 0) + 1; }); });
  var sel = $("chain"), cur = state.chain;
  sel.innerHTML = '<option value="">All chains</option>' + Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (c) {
    return '<option value="' + esc(c) + '"' + (c === cur ? " selected" : "") + ">" + esc(c) + " (" + m[c] + ")</option>";
  }).join("");
}
function renderTable() {
  var list = filtered();
  var pages = Math.max(1, Math.ceil(list.length / PER));
  if (state.page > pages) state.page = pages;
  var start = (state.page - 1) * PER;
  var pageRows = list.slice(start, start + PER);
  var maxImp = list.reduce(function (a, r) { return Math.max(a, r._imp || 0); }, 0) || 1;
  $("count").textContent = list.length === 0 ? "Showing 0 of " + rows.length : "Showing " + (start + 1) + "–" + (start + pageRows.length) + " of " + list.length + " · " + rows.length + " total";
  $("empty").hidden = list.length !== 0;
  $("reset").hidden = !isActive();
  $("body").innerHTML = pageRows.map(function (r) {
    var chg = r.change_7d, cls = chg == null ? "mut" : (chg >= 0 ? "pos" : "neg");
    var w = Math.max(2, Math.round((r._imp / maxImp) * 100));
    return '<tr data-slug="' + esc(r.slug) + '" class="' + (r.rank <= 10 ? "top10" : "") + '">' +
      '<td class="num mut">' + r.rank + "</td>" +
      '<td><div class="pname">' + esc(r.name) + '</div><div class="psub">' + esc(r.slug) + " · " + esc(catOf(r)) + "</div></td>" +
      '<td><span class="pill">' + esc(catOf(r)) + "</span></td>" +
      "<td>" + chainsHtml(r.chains) + "</td>" +
      '<td class="r num">' + money(r.tvl_usd) + "</td>" +
      '<td class="r num ' + cls + '">' + pct(chg) + "</td>" +
      '<td class="r"><span class="num imp">' + money(r._imp) + '</span><div class="impbar"><i style="width:' + w + '%"></i></div></td>' +
      '<td class="r num">' + mult(r.multiple) + "</td>" +
      '<td class="c">' + (r.farmable ? '<span class="farm">FARM</span>' : '<span class="mut">—</span>') + "</td></tr>";
  }).join("");
  renderPager(pages);
  var map = { rank: null, name: "name-asc", category: null, tvl: "tvl-desc", chg: "chg-desc", implied: "implied-desc", mult: "mult-desc" };
  document.querySelectorAll("th[data-k]").forEach(function (th) {
    var k = map[th.getAttribute("data-k")];
    var ascKey = k ? (k.slice(-5) === "-desc" ? k.slice(0, -5) + "-asc" : k) : null;
    var descKey = k ? (k.slice(-4) === "-asc" ? k.slice(0, -4) + "-desc" : k) : null;
    var active = !!k && (state.sort === ascKey || state.sort === descKey);
    th.classList.toggle("on", active);
    var arr = th.querySelector(".arr");
    if (arr) arr.textContent = active ? (state.sort.slice(-4) === "-asc" ? "▲" : "▼") : "";
  });
}
function renderPager(pages) {
  var p = state.page, h = "";
  function btn(n, label, dis, on) { return '<button data-p="' + n + '"' + (dis ? " disabled" : "") + (on ? ' class="on"' : "") + ">" + (label || n) + "</button>"; }
  h += btn(p - 1, "‹ Prev", p <= 1);
  var nums = [];
  if (pages <= 7) { for (var i = 1; i <= pages; i++) nums.push(i); }
  else {
    nums = [1, 2, p - 1, p, p + 1, pages - 1, pages].filter(function (n, i, a) { return n >= 1 && n <= pages && a.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
  }
  var prev = 0;
  nums.forEach(function (n) { if (n - prev > 1) h += '<span class="el">…</span>'; h += btn(n, null, false, n === p); prev = n; });
  h += btn(p + 1, "Next ›", p >= pages);
  $("pager").innerHTML = h;
}
function renderAll() { renderFunnel(); renderKpis(); renderHero(); renderLive(); renderCats(); renderChains(); renderTable(); }
function resetFilters() {
  state.q = ""; state.cat = ""; state.chain = ""; state.tvl = ""; state.farm = false; state.sort = "implied-desc"; state.page = 1;
  $("q").value = ""; $("cat").value = ""; $("chain").value = ""; $("sort").value = "implied-desc";
  $("farmT").setAttribute("aria-pressed", "false");
  document.querySelectorAll("#tvlSeg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tvl") === ""); });
  renderTable();
}
function mcatDerivation(r) {
  var n = r.peer_count || 0;
  var catMed = r.cat_median;
  var gm = (r.global_median != null) ? r.global_median : GF;
  var K = 5;
  var label, formula, note;
  if (n === 0 || catMed == null) {
    label = "No tokenized peers in this category — global median applies";
    formula = "M_cat = global median = " + fnum(gm, 4);
    note = "With no peers, the category multiple is the global median " + fnum(gm, 4) + ".";
  } else {
    var thin = n < 3;
    var priorPct = Math.round((K / (n + K)) * 100);
    label = n + (n === 1 ? " peer" : " peers") + (thin ? " — shrunk toward global" : "");
    formula = "(" + n + " × " + fnum(catMed, 4) + " + " + K + " × " + fnum(gm, 4) + ") / (" + n + " + " + K + ") = " + fnum(r.multiple, 4);
    note = thin
      ? "Only " + n + (n === 1 ? " peer" : " peers") + ", so the raw category median " + fnum(catMed, 4) + " is not trusted on its own — it is pulled toward the global median " + fnum(gm, 4) + " with k = " + K + ". The applied M_cat is the shrunk value " + fnum(r.multiple, 4) + ", not the raw median. n=" + n + " peer" + (n === 1 ? "" : "s") + "; shrinkage weight " + priorPct + "% on global median."
      : "The category median " + fnum(catMed, 4) + " from " + n + " peers is shrunk toward the global median " + fnum(gm, 4) + " with k = " + K + ". The applied M_cat is the shrunk value " + fnum(r.multiple, 4) + ", not the raw median.";
  }
  var setter = (r.comparables || []).filter(function (c) { return c.is_median_setter; })[0];
  var peerLine = "";
  if (setter) {
    peerLine = '<div class="deriv-n">Peer that sets the category median: <b>' + esc(setter.name) + "</b> — TVL " + money(setter.tvl_usd) + ", mcap " + money(setter.mcap_usd) + ", ratio " + fnum(setter.multiple, 4) + "x. The shrunk M_cat above is not this peer's ratio.</div>";
  }
  return '<div class="deriv"><div class="deriv-t">M_cat derivation — ' + esc(label) + '</div>' +
    '<div class="deriv-grid"><span>Peers in category (n)</span><b>' + n + '</b>' +
    '<span>Category median</span><b>' + (catMed == null ? "—" : fnum(catMed, 4)) + '</b>' +
    '<span>Global median</span><b>' + fnum(gm, 4) + '</b>' +
    '<span>Shrinkage weight (k)</span><b>' + K + '</b></div>' +
    '<div class="deriv-f">' + esc(formula) + '</div>' +
    '<div class="deriv-n">' + esc(note) + '</div>' + peerLine + '</div>' +
    '<div class="deriv-n haircut-note">No flat haircut: the old 0.50 discount was dropped — its conservatism now lives in the shrinkage toward the global median.</div>';
}
function openDetail(slug) {
  var r = rows.filter(function (x) { return x.slug === slug; })[0];
  if (!r) return;
  var catRank = rows.filter(function (x) { return catOf(x) === catOf(r) && x._imp > r._imp; }).length + 1;
  var pr = r.peer_range;
  var comp = (r.comparables || []).map(function (c) {
    var role = c.is_median_setter ? "median peer" : "peer";
    var roleNote = c.is_median_setter ? ' <span class="mut">(informational only)</span>' : "";
    return "<tr><td><b>" + esc(c.name) + "</b><br><span class=\"mut\">" + esc(c.slug || "") + "</span></td><td class=\"r num\">" + money(c.tvl_usd) + "</td><td class=\"r num\">" + money(c.mcap_usd) + "</td><td class=\"r num\">" + mult(c.multiple) + "</td><td class=\"r\">" + esc(role) + roleNote + "</td></tr>";
  }).join("");
  var steps = (r.farm_steps || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
  var age = (r.listed_at ? esc(r.listed_at) : "—") + (r.age_years != null ? " · " + fnum(r.age_years, 1) + " yrs (" + (r.age_days || 0) + " days)" : "");
  $("sheet").innerHTML =
    '<button class="x" id="xBtn" aria-label="Close">×</button>' +
    '<div class="d-head"><span class="rank-b">RANK #' + r.rank + '</span><div><div class="d-name">' + esc(r.name) + '</div><div class="d-meta">' + esc(catOf(r)) + " · " + esc(r.slug) + " · " + esc((r.chains || []).join(", ") || "—") + "</div></div></div>" +
    '<div class="status"><b>No token found in the snapshot; no airdrop is promised or confirmed.</b> This protocol records no token. Implied value is a model estimate of what a token could be worth at peer multiples — not a price, not a launch date.</div>' +
    '<div class="d-cols"><div>' +
    "<h3>Implied value — breakdown</h3>" +
    '<div class="big">' + money(r._imp) + "</div>" +
    '<div class="frow"><span class="fl">TVL</span><span class="fv">' + money(r.tvl_usd) + "</span></div>" +
    '<div class="frow"><span class="fl">× M<span style="font-size:11px">cat</span> — shrunk category multiple, ' + esc(catOf(r)) + '</span><span class="fv">' + mult(r.multiple) + "<small>" + (r.peer_count || 0) + (r.peer_count === 1 ? " peer" : " peers") + (pr ? " · range " + mult(pr[0]) + " – " + mult(pr[1]) : " · no peers, global median " + fnum(GF, 4)) + "</small></span></div>" +
    (r.tvl_quality && r.tvl_quality !== "protocol" ? '<div class="flag">TVL quality: ' + esc(r.tvl_quality) + "</div>" : "") +
    mcatDerivation(r) +
    '<div class="frow"><span class="fl">× G — growth / momentum</span><span class="fv">' + fnum(r.factor_g) + "</span></div>" +
    '<div class="deriv-n">G = 1 + clamp(7d change / 100, −0.15, +0.20); this row: ' + (r.change_7d == null ? "no 7-day change recorded" : pct(r.change_7d)) + " → " + fnum(r.factor_g) + ".</div>" +
    '<div class="frow"><span class="fl">× B — breadth (chains / reach)</span><span class="fv">' + fnum(r.factor_b) + "</span></div>" +
    '<div class="deriv-n">B = 1 + 0.03 × min(max(chains − 1, 0), 10); this row: ' + (r.chains || []).length + " chain" + ((r.chains || []).length === 1 ? "" : "s") + " → " + fnum(r.factor_b) + ".</div>" +
    '<div class="frow"><span class="fl">× A — age / track record</span><span class="fv">' + fnum(r.factor_a) + "</span></div>" +
    '<div class="deriv-n a-note">A = 0.90 + 0.05 × min(age, 2) − 0.05 × max(age − 2, 0), clamped [0.80, 1.00]; this row: ' + (r.age_years == null ? "no listing date recorded" : fnum(r.age_years, 1) + " yrs") + " → " + fnum(r.factor_a) + ". Peaks at 1–2 years and falls for very old protocols.</div>" +
    '<div class="frow tot"><span class="fl">= Implied value (recomputed)</span><span class="fv">' + money(r._imp) + "</span></div>" +
    "<h3>Comparables — tokenized peers</h3>" +
    (comp ? '<table class="mini"><thead><tr><th>Peer</th><th class="r">TVL</th><th class="r">FDV / mcap</th><th class="r">Multiple</th><th class="r">Role</th></tr></thead><tbody>' + comp + "</tbody></table>"
      : '<p class="mut">No tokenized peer in this category with a listed multiple in the snapshot; the global median ' + fnum(GF, 4) + ' applies.</p>') +
    "</div><div>" +
    "<h3>Farm plan</h3>" +
    (r.farmable && steps ? '<ol class="steps">' + steps + "</ol>" : "<p class=\"mut\">No farm plan — this protocol is not marked farmable in this entry.</p>") +
    "<h3>Effort · cost · risk</h3><dl class=\"kv\">" +
    "<dt>Effort</dt><dd>" + ((r.farm_steps || []).length || "—") + " steps, generated from the protocol's own record</dd>" +
    "<dt>Cost</dt><dd>Not priced in snapshot — check gas &amp; fees first</dd>" +
    "<dt>Risk</dt><dd>No token promised; value is a model estimate</dd>" +
    "<dt>Farmable</dt><dd>" + (r.farmable ? "Yes" : "No") + "</dd></dl>" +
    "<h3>Facts</h3><dl class=\"kv\">" +
    "<dt>Chains</dt><dd>" + esc((r.chains || []).join(", ") || "—") + "</dd>" +
    "<dt>Listed</dt><dd>" + age + "</dd>" +
    "<dt>7d TVL</dt><dd>" + pct(r.change_7d) + "</dd>" +
    "<dt>Category rank</dt><dd>#" + catRank + " in " + esc(catOf(r)) + "</dd>" +
    "<dt>Watchlist</dt><dd>" + (r.watchlist ? "Yes" : "No") + "</dd>" +
    "<dt>TVL</dt><dd>" + money(r.tvl_usd) + "</dd></dl>" +
    "</div></div>";
  $("ov").hidden = false;
  document.body.style.overflow = "hidden";
  $("xBtn").addEventListener("click", closeDetail);
  $("xBtn").focus();
}
function closeDetail() {
  $("ov").hidden = true;
  document.body.style.overflow = "";
  if (location.hash.indexOf("#/p/") === 0) {
    try { history.replaceState(null, "", location.pathname + location.search); }
    catch (e) { location.hash = ""; }
  }
}
function route() {
  var m = location.hash.match(/^#\/p\/([\w.-]+)/);
  if (m) openDetail(m[1]); else if (!$("ov").hidden) closeDetail();
}
var deb;
$("q").addEventListener("input", function (e) { clearTimeout(deb); deb = setTimeout(function () { state.q = e.target.value; state.page = 1; renderTable(); }, 150); });
$("cat").addEventListener("change", function (e) { state.cat = e.target.value; state.page = 1; renderTable(); });
$("chain").addEventListener("change", function (e) { state.chain = e.target.value; state.page = 1; renderTable(); });
$("sort").addEventListener("change", function (e) { state.sort = e.target.value; state.page = 1; renderTable(); });
$("farmT").addEventListener("click", function () { state.farm = !state.farm; $("farmT").setAttribute("aria-pressed", String(state.farm)); state.page = 1; renderTable(); });
$("tvlSeg").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; state.tvl = b.getAttribute("data-tvl"); state.page = 1; document.querySelectorAll("#tvlSeg button").forEach(function (x) { x.classList.toggle("on", x === b); }); renderTable(); });
$("reset").addEventListener("click", resetFilters);
$("clearF").addEventListener("click", resetFilters);
$("pager").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b || b.disabled) return; state.page = parseInt(b.getAttribute("data-p"), 10); renderTable(); window.scrollTo({ top: 0, behavior: "smooth" }); });
document.body.addEventListener("click", function (e) {
  var tr = e.target.closest("tr[data-slug]");
  if (tr) { var sl = tr.getAttribute("data-slug"); location.hash = "#/p/" + sl; openDetail(sl); return; }
  var th = e.target.closest("th[data-k]");
  if (th) {
    var k = th.getAttribute("data-k");
    var map = { name: "name-asc", tvl: "tvl-desc", chg: "chg-desc", implied: "implied-desc", mult: "mult-desc" };
    if (map[k]) {
      var t = map[k];
      if (state.sort === t) t = t.slice(-5) === "-desc" ? t.slice(0, -5) + "-asc" : t.slice(0, -4) + "-desc";
      state.sort = t; $("sort").value = t; state.page = 1; renderTable();
    }
  }
});
$("ov").addEventListener("click", function (e) { if (e.target === $("ov")) closeDetail(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("ov").hidden) closeDetail(); });
window.addEventListener("hashchange", route);
renderAll();
route();
