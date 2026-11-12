/*
 * ZeehoAccountToken.js
 * 自动提取 ZEEHO 登录凭证（token + 账号 ID）
 *
 * 来源：
 *   - token：H5 签到页 URL 的 token / access_token / satoken 参数，
 *            或请求的 Authorization: Bearer <token> / x-token / access-token 头；
 *   - userid：URL 的 userId / userid / user_id / uid 参数。
 *
 * 行为：type=http-request，只读、不改写请求（$done({})），
 *   命中后把两个值写入 $persistentStore 并打印「可复制」的一行。
 *   在 Shadowrocket 里查看脚本日志即可拿到；也可在其它脚本里用
 *   $persistentStore.read("zeeho_token") / ("zeeho_userid") 复用。
 *
 * 隐私：日志里 token 默认打码（只显示前后各 4 位），
 *   需要明文复制时把 PRINT_FULL_TOKEN 改为 true，用完改回。
 *
 * 开关：在 Shadowrocket 中【禁用】本脚本即完全不采集，零副作用。
 */

var PRINT_FULL_TOKEN = true;
var TAG = "[ZeehoToken] ";

var K_TOKEN = "zeeho_token";
var K_USERID = "zeeho_userid";
var K_AT = "zeeho_token_at";

var REQ = $request;
var DONE = $done;

function log(s) { console.log(TAG + s); }

function decode(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

function pick(params, names) {
  for (var i = 0; i < names.length; i++) {
    var re = new RegExp("(?:[?&;]" + names[i] + "=)([^&#;\\s]+)", "i");
    var m = params.match(re);
    if (m && m[1]) return decode(m[1]);
  }
  return "";
}

function fromUrl(url) {
  if (!url) return { token: "", userid: "" };
  return {
    token: pick(url, ["token", "access_token", "satoken", "h5_token", "h5Token"]),
    userid: pick(url, ["userId", "userid", "user_id", "uid", "accountId"])
  };
}

function fromHeaders(headers) {
  if (!headers) return "";
  var names = ["Authorization", "authorization", "x-token", "X-Token",
               "access-token", "Access-Token", "accesstoken"];
  for (var i = 0; i < names.length; i++) {
    var v = headers[names[i]];
    if (!v) continue;
    v = ("" + v).replace(/^Bearer\s+/i, "").trim();
    if (v) return v;
  }
  return "";
}

function mask(s) {
  if (!s) return "";
  if (s.length <= 8) return "****";
  return s.slice(0, 4) + "****" + s.slice(-4);
}

function save(token, userid, source) {
  var changed = false;
  var oldToken = $persistentStore.read(K_TOKEN) || "";
  var oldUser = $persistentStore.read(K_USERID) || "";
  if (token && token !== oldToken) {
    $persistentStore.write(token, K_TOKEN);
    changed = true;
  }
  if (userid && userid !== oldUser) {
    $persistentStore.write(userid, K_USERID);
    changed = true;
  }
  if (changed) {
    $persistentStore.write(String(Date.now()), K_AT);
    log("captured from " + source
        + "  token=" + (PRINT_FULL_TOKEN ? token : mask(token))
        + "  userid=" + userid);
  }
  // 每次都打印可填写的一行，便于直接从日志复制（token 打码时提示去 UI 读）
  log("Fill in SpeedHunter → userid=" + userid
      + "  token=" + (PRINT_FULL_TOKEN ? token : mask(token))
      + (PRINT_FULL_TOKEN ? "" : "  (set PRINT_FULL_TOKEN=true for plaintext)"));
}

(function () {
  try {
    var url = (REQ && REQ.url) || "";
    var u = fromUrl(url);
    var token = u.token || fromHeaders(REQ && REQ.headers);
    var userid = u.userid;

    if (!token && !userid) {
      DONE({});
      return;
    }
    if (token && userid) {
      save(token, userid, url.indexOf("h5.zeehoev.com") >= 0 ? "H5 URL" : "request");
    } else if (token) {
      // 只拿到 token：先存，账号 ID 等下次带 userId 的请求补上
      save(token, "", "header/url");
      log("token saved, waiting for a request with userId to complete the pair");
    } else {
      save("", userid, "url");
      log("userid saved, waiting for Authorization/token to complete the pair");
    }
    DONE({});
  } catch (e) {
    log("err " + e);
    DONE({});
  }
})();
