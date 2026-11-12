/*
 * ZeehoCustomKey.js
 * 把「自定义按键」的功能码强制为 7（切换仪表信息组）—— iOS Shadowrocket 版，
 * 机制：
 *   自定义按键保存走云端单属性写接口
 *     PUT /v1.0/app/cfmotoserverapp/vehicleSet/propertyOne/one
 *     {"relatedFunctions":{},"commond":"142","version":"v2","commondParam":"1","vcu":"<VIN>"}
 *   其中 commond = 设置项 ID（142 = 自定义按键），commondParam = 功能码（1 = Hello 音效 1）。
 *   本脚本在请求离机前把 commondParam 改成 7，车端 SetItem4 落入 7，仪表主页按自定义键
 *   即在「里程组 ⇄ 胎压组」间切换，从而显示前后轮胎压 / 胎温。
 *
 * 关键：改包体必须重算签名
 *   官方 App 在发请求前用 cfmoto-x-param + 请求体算了 Cfmoto-X-Sign：
 *     sign = MD5( hex(SHA-1( sortedQuery + body + cfmoto-x-param + secret )) )
 *   Shadowrocket 在传输层拦包，改完 body 原签名即失效、服务端会拒。故本脚本内置
 *   MD5/SHA-1（纯 JS，无外部依赖）并在改写后重算 cfmoto-x-sign / signature 两个头。
 *   算法已用实抓请求逐字节复现验证（GET 空 body 用例完全一致）。
 *
 * 安全边界：
 *   - 只对 vehicleSet/propertyOne 且 commond ∈ ITEM_IDS 的请求生效，其余一律原样放行；
 *   - 只改 commondParam 一个字段，relatedFunctions / vcu / version 一概不动；
 *   - 重算签名失败时放弃改写、原样放行，绝不让保存因本脚本失败；
 *   - 整段 try/catch，异常退化为原样放行；
 *   - App 界面仍显示用户点的那张卡片（展示名不动），只有上报的功能码被改写。
 */

// ===== 可调参数 =====
var ENABLE = true;          // false = 完全静默放行（等价关闭）
var DEBUG = false;          // true = 打印命中的请求体（日志含 VIN / 账号，谨慎开启）
var TARGET = 7;             // 目标功能码：7 = 切换仪表信息组
var ITEM_IDS = ["142"];     // commond 白名单：142 = 自定义按键设置项

// 云 API 签名密钥（tapi / h5 两组），与 Android SpeedHunter net/AccountApi 同源。
// 仅本地自用，勿外传；如需轮换只改这两行。
var SECRET_TAPI = "c5e0da7f4da28df805694ec3dd1fc6792e9df99d";
var SECRET_H5 = "70c2c7458ab88ca9504ad0521f170075bc91f2f7";

var REQ = $request;
var DONE = $done;
var TAG = "[ZeehoKey] ";

function log(s) { console.log(TAG + s); }

// ==================== 摘要算法（纯 JS，UTF-8） ====================

function utf8(s) {
  var out = [], i, c;
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      var c2 = s.charCodeAt(++i);
      var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
               0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return out;
}

function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
function hexBE(n) {
  var s = "", i;
  for (i = 3; i >= 0; i--) s += ("0" + (((n >>> (i * 8)) & 0xFF).toString(16))).slice(-2);
  return s;
}
function hexLE(n) {
  var s = "", i;
  for (i = 0; i < 4; i++) s += ("0" + (((n >>> (i * 8)) & 0xFF).toString(16))).slice(-2);
  return s;
}

function sha1Hex(str) {
  var m = utf8(str), ml = m.length * 8, i, j;
  m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  var hi = Math.floor(ml / 4294967296), lo = ml >>> 0;
  m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
  m.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

  var H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
  var K = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];

  for (i = 0; i < m.length; i += 64) {
    var w = new Array(80);
    for (j = 0; j < 16; j++) {
      w[j] = ((m[i + j * 4] << 24) | (m[i + j * 4 + 1] << 16) |
              (m[i + j * 4 + 2] << 8) | m[i + j * 4 + 3]) | 0;
    }
    for (j = 16; j < 80; j++) w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);

    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];
    for (j = 0; j < 80; j++) {
      var f, k;
      if (j < 20) { f = (b & c) | ((~b) & d); k = K[0]; }
      else if (j < 40) { f = b ^ c ^ d; k = K[1]; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = K[2]; }
      else { f = b ^ c ^ d; k = K[3]; }
      var t = (rotl(a, 5) + f + e + k + w[j]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
  }
  var out = "";
  for (i = 0; i < 5; i++) out += hexBE(H[i]);
  return out;
}

function md5Hex(str) {
  var m = utf8(str), ml = m.length * 8, i, j;
  m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  var hi = Math.floor(ml / 4294967296), lo = ml >>> 0;
  m.push(lo & 255, (lo >>> 8) & 255, (lo >>> 16) & 255, (lo >>> 24) & 255);
  m.push(hi & 255, (hi >>> 8) & 255, (hi >>> 16) & 255, (hi >>> 24) & 255);

  var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
           5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
           4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
           6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var K = [];
  for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;

  var H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
  for (i = 0; i < m.length; i += 64) {
    var w = new Array(16);
    for (j = 0; j < 16; j++) {
      w[j] = (m[i + j * 4] | (m[i + j * 4 + 1] << 8) |
              (m[i + j * 4 + 2] << 16) | (m[i + j * 4 + 3] << 24)) | 0;
    }
    var A = H[0], B = H[1], C = H[2], D = H[3];
    for (j = 0; j < 64; j++) {
      var F, g;
      if (j < 16) { F = (B & C) | ((~B) & D); g = j; }
      else if (j < 32) { F = (D & B) | ((~D) & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | (~D)); g = (7 * j) % 16; }
      var tmp = D; D = C; C = B;
      var sum = (A + F + K[j] + w[g]) | 0;
      B = (B + rotl(sum, S[j])) | 0;
      A = tmp;
    }
    H[0] = (H[0] + A) | 0; H[1] = (H[1] + B) | 0;
    H[2] = (H[2] + C) | 0; H[3] = (H[3] + D) | 0;
  }
  var out = "";
  for (i = 0; i < 4; i++) out += hexLE(H[i]);
  return out;
}

// ==================== 签名重算 ====================

// 按 key 升序拼 query（k=v&k=v，不做额外编码，与 App 一致）
function sortedQuery(url) {
  var q = url.indexOf("?");
  if (q < 0 || q >= url.length - 1) return "";
  var pairs = url.substring(q + 1).split("&"), map = [], i;
  for (i = 0; i < pairs.length; i++) {
    if (!pairs[i]) continue;
    var e = pairs[i].indexOf("=");
    map.push({
      k: e < 0 ? pairs[i] : pairs[i].substring(0, e),
      v: e < 0 ? "" : pairs[i].substring(e + 1)
    });
  }
  map.sort(function (x, y) { return x.k < y.k ? -1 : (x.k > y.k ? 1 : 0); });
  var out = [];
  for (i = 0; i < map.length; i++) out.push(map[i].k + "=" + map[i].v);
  return out.join("&");
}

function findKey(headers, name) {
  var lower = name.toLowerCase();
  for (var k in headers) {
    if (headers.hasOwnProperty(k) && k.toLowerCase() === lower) return k;
  }
  return null;
}

// 返回新的 headers；无法重算时返回 null（调用方据此放弃改写）
function resign(url, body, headers) {
  try {
    headers = headers || {};
    var pk = findKey(headers, "cfmoto-x-param");
    if (!pk) return null;
    var param = headers[pk];
    if (!param) return null;
    var secret = url.indexOf("h5.zeehoev.com") >= 0 ? SECRET_H5 : SECRET_TAPI;
    // h5 域只签 query，不拼 body（与官方 H5 口径一致）；tapi 域 body 必须入签
    var bodyPart = url.indexOf("h5.zeehoev.com") >= 0 ? "" : body;
    var raw = sortedQuery(url) + bodyPart + param + secret;
    var sign = md5Hex(sha1Hex(raw));

    var sk = findKey(headers, "cfmoto-x-sign");
    var gk = findKey(headers, "signature");
    if (!sk && !gk) return null;      // 连签名字段都没有，不碰
    if (sk) headers[sk] = sign;
    if (gk) headers[gk] = sign;
    return headers;
  } catch (e) {
    log("resign err " + e);
    return null;
  }
}

// ==================== 主流程 ====================

function isTargetItem(id) {
  for (var i = 0; i < ITEM_IDS.length; i++) {
    if (("" + ITEM_IDS[i]) === id) return true;
  }
  return false;
}

(function () {
  if (!ENABLE) { DONE({}); return; }

  var url = (REQ && REQ.url) || "";
  var body = (REQ && REQ.body) || "";

  try {
    if (!body) { DONE({}); return; }
    // 只处理单属性写接口；其余（dbpoint 埋点、查询接口）一律放行
    if (url.indexOf("vehicleSet/propertyOne") < 0) { DONE({}); return; }

    var obj;
    try { obj = JSON.parse(body); } catch (e) { DONE({}); return; }
    if (!obj || typeof obj !== "object") { DONE({}); return; }

    if (DEBUG) log("URL=" + url + " BODY=" + body.slice(0, 2000));

    var itemId = obj.commond === undefined || obj.commond === null ? "" : ("" + obj.commond);
    if (!itemId || !isTargetItem(itemId)) {
      if (DEBUG) log("commond=" + itemId + " 不在白名单，放行");
      DONE({});
      return;
    }

    var cur = obj.commondParam === undefined || obj.commondParam === null
      ? "" : ("" + obj.commondParam);
    if (cur === ("" + TARGET)) {
      log("commond=" + itemId + " 已是 " + TARGET + "，无需改写");
      DONE({});
      return;
    }

    // 保持原字段类型（实测为字符串 "1"）
    obj.commondParam = typeof obj.commondParam === "number" ? TARGET : ("" + TARGET);
    var newBody = JSON.stringify(obj);

    var newHeaders = resign(url, newBody, REQ && REQ.headers);
    if (!newHeaders) {
      // 无签名头 → 改了会被服务端拒，宁可放弃改写
      log("无法重算签名，放弃改写（原样放行）");
      DONE({});
      return;
    }

    log("commond=" + itemId + " commondParam " + cur + " -> " + TARGET +
        "（切换信息组）已重算签名");
    DONE({ body: newBody, headers: newHeaders });
  } catch (e) {
    log("err " + e);
    DONE({});   // 任何异常退化为原样放行，绝不阻断保存
  }
})();
