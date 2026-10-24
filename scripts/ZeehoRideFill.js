/*
 * ZeehoRideFill.js
 * 由 ridetrack_v2 轨迹点估算急刹/压弯次数，按日缓存回填 myRideInfo / homeRideInfo / analyse。
 * 估算函数：countBrakes()（急刹，固定）、countBends()（压弯）；日缓存：accumDay / readDay / writeDay。
 *
 * 调整压弯数据（countBends，参数均在下方 C 对象，改完直接生效）：
 *   C.BEND_COEF        主旋钮，默认 1.00；>1 多计、<1 少计，日常标定只改这一个
 *   C.BEND_V_MIN/MAX   判定压弯的车速区间（仅此区间内计弯）
 *   C.BEND_SEED        起判单点转角阈值；C.BEND_STEP_MAX 超过则视为掉头/锯齿，跳过点
 *   C.BEND_CUM_MIN/MAX 一段同向转角累计角度的下限/上限过滤
 *   C.BEND_ALLOW_GAP / C.BEND_MERGE_GAP  相邻转弯的间隙容忍与同向合并容差
 *
 * 标定验证：
 *   C.DEBUG = true 打开逐段诊断（日志前缀 [DBG]）；
 *   C.TARGET_RIDE_IDS 填入 rideId 只看指定行程，留空数组则打印全部。
 */

console.log("[ZeehoFill] START");

// 别名：缓存关键全局对象，全文只用短名
var PS = $persistentStore;
var REQ = $request;
var RES = $response;
var DONE = $done;

var C = {
  // 急刹参数（固定，不动）
  V_MIN: 15, WIN_LARGE: 5, WIN_SMALL: 3,
  DV_LARGE: 15, DV_SMALL: 20, A_MIN: 0.5,
  MERGE_GAP: 5, MIN_DUR: 1.5,
  // 压弯参数
  BEND_V_MIN: 20,
  BEND_V_MAX: 80,
  BEND_SEED: 5,
  BEND_STEP_MAX: 45,
  BEND_CUM_MIN: 15,
  BEND_CUM_CAP: 90,
  BEND_RUN_MIN: 1,
  BEND_ALLOW_GAP: 0,
  BEND_MERGE_GAP: 0,
  BEND_SEG_DIST_MIN: 6,
  BEND_GAP_MS_MAX: 25000,
  CALIB_FACTOR: 2.5,
  BEND_COEF: 1.00,
  LOG: true,
  // DEBUG 默认 false，标定参数时手动打开
  DEBUG: false
};

function log(s) { if (C.LOG) console.log("[ZeehoFill] " + s); }
function dbg(s) { if (C.DEBUG) console.log("[DBG] " + s); }
function isZero(v) { return v === 0 || v === "0" || v === null || v === undefined; }

// 精确控制：只打印指定 rideId 的轨迹数据（留空数组 = 全部打印）
var TARGET_RIDE_IDS = [];

function parseTraj(traj) {
  if (!traj || typeof traj !== 'string') return [];
  var pts = [], seg = traj.split("&");
  for (var i = 0; i < seg.length; i++) {
    var p = seg[i].split(",");
    if (p.length < 4) continue;
    var lon = parseFloat(p[0]), lat = parseFloat(p[1]);
    var v = parseFloat(p[2]), t = parseFloat(p[3]);
    if (isNaN(lon) || isNaN(lat) || isNaN(v) || isNaN(t)) continue;
    pts.push({ lon: lon, lat: lat, v: v, t: t, d: p.length > 4 ? (parseFloat(p[4]) || 0) : 0 });
  }
  return pts;
}

function bearing(lon1, lat1, lon2, lat2) {
  var y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
          Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.cos((lon2 - lon1) * Math.PI / 180);
  return Math.atan2(y, x) * 180 / Math.PI;
}
function angDiff(a, b) { var d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360; return d; }
function mid(a, b) { return a + angDiff(a, b) / 2; }
function distM(lon1, lat1, lon2, lat2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---- 急刹 countBrakes（固定）----
function countBrakes(pts) {
  var n = pts.length; if (n < 4) return 0;
  var cands = [], i, j;
  function scan(win, dvMin) {
    for (var i = 0; i <= n - win; i++) {
      if (pts[i].v < C.V_MIN) continue;
      var maxV = -Infinity, maxIdx = i, minV = Infinity, minIdx = i;
      for (var j = i + 1; j <= i + win && j < n; j++) {
        if (pts[j].v > maxV) { maxV = pts[j].v; maxIdx = j; }
        if (pts[j].v < minV) { minV = pts[j].v; minIdx = j; }
      }
      var dv = maxV - minV;
      if (dv < dvMin) continue;
      if (minIdx <= maxIdx) continue;
      var dt = (pts[minIdx].t - pts[maxIdx].t) / 1000;
      if (dt < C.MIN_DUR) continue;
      if (dv / 3.6 / dt < C.A_MIN) continue;
      cands.push({ idx: maxIdx, dv: dv });
    }
  }
  scan(C.WIN_LARGE, C.DV_LARGE);
  scan(C.WIN_SMALL, C.DV_SMALL);
  cands.sort(function (a, b) { return a.idx - b.idx; });
  var merged = [];
  for (i = 0; i < cands.length; i++) {
    if (merged.length === 0 || cands[i].idx - merged[merged.length - 1].idx >= C.MERGE_GAP) merged.push(cands[i]);
    else if (cands[i].dv > merged[merged.length - 1].dv) merged[merged.length - 1] = cands[i];
  }
  var r = Math.round(merged.length * C.CALIB_FACTOR);
  return r < 0 ? 0 : r;
}

// ---- 压弯 countBends（累计转角法）----
function countBends(pts) {
  if (!pts || pts.length < 4) return 0;
  var n = pts.length, i;

  // 1) 逐段航向（无效段标 NaN）
  var hdg = [], segD = [], dt = [];
  for (i = 0; i < n - 1; i++) {
    var d = distM(pts[i].lon, pts[i].lat, pts[i + 1].lon, pts[i + 1].lat);
    var tt = pts[i + 1].t - pts[i].t;
    segD[i] = d; dt[i] = tt;
    if (d < C.BEND_SEG_DIST_MIN || tt > C.BEND_GAP_MS_MAX || tt <= 0) hdg[i] = NaN;
    else hdg[i] = bearing(pts[i].lon, pts[i].lat, pts[i + 1].lon, pts[i + 1].lat);
  }

  // 2) 三点圆均值平滑，压掉 GPS 锯齿
  var sh = [];
  for (i = 0; i < n - 1; i++) {
    if (isNaN(hdg[i])) { sh[i] = NaN; continue; }
    var a = (i > 0 && !isNaN(hdg[i - 1])) ? hdg[i - 1] : null;
    var b = hdg[i];
    var c = (i < n - 2 && !isNaN(hdg[i + 1])) ? hdg[i + 1] : null;
    if (a !== null && c !== null) sh[i] = mid(mid(a, b), c);
    else if (a !== null) sh[i] = mid(a, b);
    else if (c !== null) sh[i] = mid(b, c);
    else sh[i] = b;
  }

  // 3) 逐点标记「是否在转弯中」
  var turn = [], dhdg = [], sgn = [];
  for (i = 1; i < n - 1; i++) {
    turn[i] = false; dhdg[i] = 0; sgn[i] = 0;
    if (isNaN(sh[i - 1]) || isNaN(sh[i])) continue;
    var d = angDiff(sh[i - 1], sh[i]);
    dhdg[i] = d;
    var vIn = Math.max(pts[i - 1].v || 0, pts[i].v || 0);
    if (vIn < C.BEND_V_MIN) continue;
    if (vIn > C.BEND_V_MAX) continue;
    if (Math.abs(d) >= C.BEND_STEP_MAX) continue;
    if (Math.abs(d) >= C.BEND_SEED) { turn[i] = true; sgn[i] = (d > 0) ? 1 : -1; }
  }

  // 4) 合并为「同向转动区间」
  var runs = [], cur = null, gap = 0;
  for (i = 1; i < n - 1; i++) {
    if (turn[i]) {
      if (!cur) cur = { s: i, e: i, cum: 0, sign: sgn[i] };
      if (sgn[i] === cur.sign) { cur.e = i; cur.cum += Math.abs(dhdg[i]); gap = 0; }
      else { runs.push(cur); cur = { s: i, e: i, cum: Math.abs(dhdg[i]), sign: sgn[i] }; gap = 0; }
    } else {
      if (cur && gap < C.BEND_ALLOW_GAP) { gap++; cur.e = i; continue; }
      if (cur) { runs.push(cur); cur = null; }
    }
  }
  if (cur) runs.push(cur);

  // 5) 角度+时长+速度+上限双过滤，再按时间邻近合并同向区间
  var cnt = 0, lastEnd = -9999, lastSign = 0;
  for (i = 0; i < runs.length; i++) {
    var r = runs[i];
    if (r.cum < C.BEND_CUM_MIN) continue;
    if (r.cum > C.BEND_CUM_CAP) continue;
    if (r.e - r.s + 1 < C.BEND_RUN_MIN) continue;
    var maxV = 0;
    for (var j = r.s; j <= r.e; j++) {
      if (pts[j].v > maxV) maxV = pts[j].v;
    }
    if (maxV > C.BEND_V_MAX) continue;
    if (r.sign === lastSign && r.s - lastEnd <= C.BEND_MERGE_GAP) { lastEnd = r.e; continue; }
    cnt++; lastEnd = r.e; lastSign = r.sign;
  }
  return Math.round(cnt * C.BEND_COEF);
}

// ---- 调试探针 ----
function debugPrint(pts, rideId, bendCnt, startTime) {
  if (!C.DEBUG) return;
  if (TARGET_RIDE_IDS.length > 0) {
    var hit = false;
    for (var k = 0; k < TARGET_RIDE_IDS.length; k++) {
      if (TARGET_RIDE_IDS[k] === rideId) { hit = true; break; }
    }
    if (!hit) return;
  }
  var vArr = [];
  for (var p = 0; p < pts.length; p++) vArr.push(pts[p].v.toFixed(0));
  dbg("TRAJ rideId=" + rideId + " start=" + startTime + " pts=" + pts.length + " v=[" + vArr.join(",") + "]");

  var BC = {
    V_MIN: C.BEND_V_MIN, V_MAX: C.BEND_V_MAX, SEED: C.BEND_SEED,
    STEP_MAX: C.BEND_STEP_MAX, CUM_MIN: C.BEND_CUM_MIN, CUM_CAP: C.BEND_CUM_CAP,
    RUN_MIN: C.BEND_RUN_MIN, ALLOW_GAP: C.BEND_ALLOW_GAP,
    MERGE_GAP: C.BEND_MERGE_GAP, SEG_DIST_MIN: C.BEND_SEG_DIST_MIN,
    GAP_MS_MAX: C.BEND_GAP_MS_MAX
  };
  var n = pts.length, i;
  var hdg = [], segD = [], dt = [];
  for (i = 0; i < n - 1; i++) {
    var d = distM(pts[i].lon, pts[i].lat, pts[i + 1].lon, pts[i + 1].lat);
    var tt = pts[i + 1].t - pts[i].t;
    segD[i] = d; dt[i] = tt;
    if (d < BC.SEG_DIST_MIN || tt > BC.GAP_MS_MAX || tt <= 0) hdg[i] = NaN;
    else hdg[i] = bearing(pts[i].lon, pts[i].lat, pts[i + 1].lon, pts[i + 1].lat);
  }
  var sh = [];
  for (i = 0; i < n - 1; i++) {
    if (isNaN(hdg[i])) { sh[i] = NaN; continue; }
    var a = (i > 0 && !isNaN(hdg[i - 1])) ? hdg[i - 1] : null;
    var b = hdg[i];
    var c = (i < n - 2 && !isNaN(hdg[i + 1])) ? hdg[i + 1] : null;
    if (a !== null && c !== null) sh[i] = mid(mid(a, b), c);
    else if (a !== null) sh[i] = mid(a, b);
    else if (c !== null) sh[i] = mid(b, c);
    else sh[i] = b;
  }
  var turn = [], dhdg = [], sgn = [];
  for (i = 1; i < n - 1; i++) {
    turn[i] = false; dhdg[i] = 0; sgn[i] = 0;
    if (isNaN(sh[i - 1]) || isNaN(sh[i])) continue;
    var d = angDiff(sh[i - 1], sh[i]);
    dhdg[i] = d;
    var vIn = Math.max(pts[i - 1].v || 0, pts[i].v || 0);
    if (vIn < BC.V_MIN) continue;
    if (vIn > BC.V_MAX) continue;
    if (Math.abs(d) >= BC.STEP_MAX) continue;
    if (Math.abs(d) >= BC.SEED) { turn[i] = true; sgn[i] = (d > 0) ? 1 : -1; }
  }
  var runs = [], cur = null, gap = 0;
  for (i = 1; i < n - 1; i++) {
    if (turn[i]) {
      if (!cur) cur = { s: i, e: i, cum: 0, sign: sgn[i] };
      if (sgn[i] === cur.sign) { cur.e = i; cur.cum += Math.abs(dhdg[i]); gap = 0; }
      else { runs.push(cur); cur = { s: i, e: i, cum: Math.abs(dhdg[i]), sign: sgn[i] }; gap = 0; }
    } else {
      if (cur && gap < BC.ALLOW_GAP) { gap++; cur.e = i; continue; }
      if (cur) { runs.push(cur); cur = null; }
    }
  }
  if (cur) runs.push(cur);

  var details = [];
  var cnt = 0, lastEnd = -9999, lastSign = 0;
  for (i = 0; i < runs.length; i++) {
    var r = runs[i];
    var reason = "";
    if (r.cum < BC.CUM_MIN) { reason = "cum<min(" + r.cum.toFixed(1) + ")"; }
    else if (r.cum > BC.CUM_CAP) { reason = "cum>cap(" + r.cum.toFixed(1) + ")"; }
    else if (r.e - r.s + 1 < BC.RUN_MIN) { reason = "short(" + (r.e - r.s + 1) + "pt)"; }
    else {
      var mv = 0;
      for (var j = r.s; j <= r.e; j++) { if (pts[j].v > mv) mv = pts[j].v; }
      if (mv > BC.V_MAX) { reason = "speed>max(" + mv + ")"; }
    }
    if (reason) {
      details.push("R" + i + "[" + r.s + "-" + r.e + "]cum=" + r.cum.toFixed(1) + "sgn=" + r.sign + "REJ:" + reason);
      continue;
    }
    var mv2 = 0;
    for (var j = r.s; j <= r.e; j++) { if (pts[j].v > mv2) mv2 = pts[j].v; }
    details.push("R" + i + "[" + r.s + "-" + r.e + "]cum=" + r.cum.toFixed(1) + "sgn=" + r.sign + "maxV=" + mv2 + "OK");
    lastEnd = r.e; lastSign = r.sign;
  }
  dbg("BENDS rideId=" + rideId + " start=" + startTime + " cnt=" + bendCnt + " runs=" + details.join(" | "));
}

function patchGate(v) {
  if (!v || typeof v !== "object") return;
  if (v.vehicleKinds !== undefined) v.vehicleKinds = 2;
  if (v.cyclingEventStatisticFlag !== undefined) v.cyclingEventStatisticFlag = true;
}

// ---- day store ----
function dayKey(day) { return "zeeho_day_" + day; }
function readDay(day) {
  try {
    var s = PS.read(dayKey(day));
    if (!s) return null;
    return JSON.parse(s);
  } catch (e) { return null; }
}
function writeDay(day, obj) {
  try { PS.write(JSON.stringify(obj), dayKey(day)); } catch (e) { log("writeDay fail: " + e); }
}
function accumDay(day, rideId, b, d) {
  var cur = readDay(day);
  if (!cur) cur = { b: 0, d: 0, rides: {} };
  if (!cur.rides) cur.rides = {};
  // 每次无条件覆盖写入
  cur.rides[rideId] = { b: b, d: d };
  // 重算日总计
  cur.b = 0; cur.d = 0;
  for (var rid in cur.rides) {
    if (cur.rides.hasOwnProperty(rid)) {
      cur.b += cur.rides[rid].b;
      cur.d += cur.rides[rid].d;
    }
  }
  writeDay(day, cur);
  return cur;
}

// ---- 通用回填 ----
var rideCache = {};
function cacheRide(rideId, b, bd) { if (rideId) rideCache[rideId] = { b: b, bd: bd }; }
function getCache(rideId) { return rideCache[rideId] || null; }

function fillFromCache(entries, sourceName) {
  if (!entries || !Array.isArray(entries)) {
    log(sourceName + ": no array");
    return 0;
  }
  var filled = 0;
  for (var i = 0; i < entries.length; i++) {
    var r = entries[i];
    if (!r || typeof r !== 'object') continue;
    var rid = r.rideId || r.id || r.ride_no || r.recordId;
    if (!rid) continue;
    var c = getCache(rid);
    if (c) {
      if (isZero(r.brakesTimes)) { r.brakesTimes = c.b; filled++; }
      if (isZero(r.bendingTimes)) { r.bendingTimes = c.bd; filled++; }
    }
  }
  log(sourceName + " done: filled " + filled + " / " + entries.length);
  return filled;
}

// ---- 主逻辑 ----
(function () {
  // 使用 REQ 别名（非 $request）
  var req = REQ || {};
  var url = req.url || "";
  var body = RES.body || "";
  try {
    // JSON.parse 外层 try-catch
    var obj;
    try { obj = body ? JSON.parse(body) : {}; } catch (e) { log("JSON parse fail, pass through"); DONE({ body: body }); return; }
    var d = obj.data;
    if (!d) { DONE({ body: body }); return; }

    // 1. Gate
    try {
      if (url.indexOf("vehicleHomePageV2") > -1 || url.indexOf("vehicle/list") > -1) {
        if (Array.isArray(d)) { for (var i = 0; i < d.length; i++) patchGate(d[i]); }
        else patchGate(d);
      }
    } catch (e) { log("HANDLER ERROR gate: " + e); }

    // 2. ridetrack_v2
    try {
      if (url.indexOf("ridetrack_v2") > -1 && Array.isArray(d)) {
        var filled = 0;
        for (var i = 0; i < d.length; i++) {
          var day = d[i].dayTime;
          var hist = d[i].historyList || [];
          for (var j = 0; j < hist.length; j++) {
            var r = hist[j];
            if (!r.trajectory) continue;
            var pts = parseTraj(r.trajectory);
            if (pts.length < 4) continue;
            var b = countBrakes(pts);
            var bd = countBends(pts);
            if (b >= 0) { r.brakesTimes = b; filled++; }
            if (bd >= 0) { r.bendingTimes = bd; filled++; }
            var dayStr = r.dayTime || day;
            if (dayStr) accumDay(dayStr, r.rideId, b, bd);
            var startTime = r.startTime || r.recordTime || r.start_time || "";
            debugPrint(pts, r.rideId, bd, startTime);
          }
        }
        log("ridetrack_v2 done: filled " + filled + ", days cached");
      }
    } catch (e) { log("HANDLER ERROR ridetrack_v2: " + e); }

    // 3. myRideInfo
    try {
      if (url.indexOf("myRideInfo") > -1 && d && d.rideRecordList && Array.isArray(d.rideRecordList)) {
        var lst = d.rideRecordList, nFill = 0;
        for (var k = 0; k < lst.length; k++) {
          var rec = lst[k];
          var day2 = rec.date;
          if (!day2) continue;
          var st = readDay(day2);
          if (!st) continue;
          if (st.b >= 0) { rec.brakesTimesDay = String(st.b); nFill++; }
          if (st.d >= 0) { rec.bendingTimesDay = String(st.d); nFill++; }
        }
        log("myRideInfo done: filled " + nFill + " over " + lst.length + " records");

        var sumD = 0;
        for (var t = 0; t < lst.length; t++) {
          var v = parseInt(lst[t].bendingTimesDay, 10);
          if (!isNaN(v)) sumD += v;
        }
        if (d.bendingTimesTotal !== undefined && isZero(d.bendingTimesTotal)) {
          d.bendingTimesTotal = String(sumD);
          log("myRideInfo total: bendingTimesTotal=" + sumD);
        }
      }
    } catch (e) { log("HANDLER ERROR myRideInfo: " + e); }

    // 4. analyse
    try {
      if (url.indexOf("analyse") > -1 && d && d.rideMonth) {
        var m = d.rideMonth;
        var prefix = m.substring(0, 4) + "." + m.substring(4, 6);
        var sumB = 0, sumD2 = 0, found = 0;
        for (var dd = 1; dd <= 31; dd++) {
          var ds = prefix + "." + (dd < 10 ? "0" + dd : "" + dd);
          var st2 = readDay(ds);
          if (st2) { sumB += st2.b; sumD2 += st2.d; found++; }
        }
        if (found > 0) {
          if (sumB > 0) d.brakesTimes = String(sumB);
          if (sumD2 > 0) d.bendingTimes = String(sumD2);
          log("analyse done: month=" + prefix + " days=" + found + "/31 sumB=" + sumB + " sumD=" + sumD2);
        } else {
          log("analyse: no day store for " + prefix);
        }
      }
    } catch (e) { log("HANDLER ERROR analyse: " + e); }

    // 使用 DONE 别名
    DONE({ body: JSON.stringify(obj) });
  } catch (e) {
    log("FATAL " + e);
    DONE({ body: body });
  }
})();