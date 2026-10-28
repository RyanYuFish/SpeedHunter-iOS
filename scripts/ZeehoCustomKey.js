/*
 * ZeehoCustomKey.js
 * 自定义键强制为「切换信息组（功能码 7）」—— iOS 端 Shadowrocket 等价实现（对应 Android SpeedHunter v4.7/v4.7.1 的 customkey 包）。
 *
 * 机制（与 Android 完全一致）：
 *   官方 App 保存自定义键时，走 4G 云端（tapi.zeehoev.com 的 dbpoint/send 通用网关，
 *   实测从不走 BLE），请求体里带一个 commandCode 字段。本脚本在请求离机前把
 *   commandCode 强制改写成 7（切换信息组），车端 SetItem4 落入 7，仪表主页按自定义键
 *   即在「里程组 ⇄ 胎压组」间切换，首页显示前后轮胎压 / 胎温。
 *
 * 开关行为（满足「启用脚本则映射、关闭脚本则不修改」）：
 *   在 Shadowrocket 里【启用】本脚本 = 映射生效；【禁用】本脚本 = 完全不改写（原样发出）。
 *   关闭脚本时本文件根本不执行，零副作用。
 *
 * 安全边界：
 *   - 仅当请求体命中「自定义键上下文」时才改写，绝大多数 dbpoint/send 调用不触碰；
 *   - 整段包 try/catch，任何异常退化为「原样放行」，绝不阻断保存；
 *   - 默认 DEBUG=false，不打印请求体（日志可能含 VIN / 账号等敏感字段）。
 */

// ===== 可调参数 =====
var DEBUG = false;          // 改为 true 可在 Shadowrocket 日志里看到命中的请求体（用于确认字段/路径）
var TARGET = 7;             // 切换信息组功能码

var REQ = $request;
var DONE = $done;

var TAG = "[ZeehoKey] ";

// 自定义键上下文标记：命中其一即视为「自定义键保存」请求（避免误伤其它 dbpoint/send）
// ★ 全部写成无下划线形式：比对前会先把字符串里的 _ - 空格 全部剥掉，
//   因此 commandCode / command_code / CustomKey / custom_key 一律命中
var CTX_MARKERS = [
  "commandcode", "customkey", "custombutton", "buttoncode",
  "setitem", "keyfunction", "functioncode", "按键", "自定义键", "custombuttoncode"
];

// 可能承载功能码的字段名（同上去掉下划线后比对）
var CODE_KEY_HINTS = ["commandcode", "keycode", "buttoncode", "functioncode"];

function log(s) { console.log(TAG + s); }

// 归一化：小写 + 剥掉 _ - 空格，让 commandCode / command_code / Command Code 等价
function norm(s) { return ("" + s).toLowerCase().replace(/[_\-\s]/g, ""); }

function isCodeKey(k) {
  var s = norm(k);
  for (var i = 0; i < CODE_KEY_HINTS.length; i++) {
    if (s.indexOf(CODE_KEY_HINTS[i]) >= 0) return true;
  }
  return false;
}

// 递归查找并改写功能码字段；返回是否命中
function rewrite(obj) {
  if (!obj || typeof obj !== "object") return false;
  var hit = false;
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      if (rewrite(obj[i])) hit = true;
    }
    return hit;
  }
  for (var k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    if (isCodeKey(k)) {
      if (obj[k] !== TARGET) {
        log("commandCode " + obj[k] + " -> " + TARGET + "（切换信息组）");
        obj[k] = TARGET;
      }
      hit = true;
    } else if (typeof obj[k] === "object" && obj[k] !== null) {
      if (rewrite(obj[k])) hit = true;
    }
  }
  return hit;
}

function bodyHasContext(bodyStr) {
  var s = norm(bodyStr);
  for (var i = 0; i < CTX_MARKERS.length; i++) {
    if (s.indexOf(CTX_MARKERS[i]) >= 0) return true;
  }
  return false;
}

(function () {
  var url = (REQ && REQ.url) || "";
  var body = (REQ && REQ.body) || "";
  try {
    if (!body) { DONE({}); return; }
    var obj;
    try { obj = JSON.parse(body); } catch (e) { DONE({}); return; }

    var ctx = bodyHasContext(body);
    if (DEBUG) log("URL=" + url + " CTX=" + ctx + " BODY=" + body.slice(0, 4000));

    if (!ctx) { DONE({}); return; }   // 不是自定义键上下文，原样放行

    var changed = rewrite(obj);
    if (changed) {
      log("mapped custom-key -> switch-info (7) at " + url);
      DONE({ body: JSON.stringify(obj) });
    } else {
      // 命中上下文但没找到功能码字段：可能字段名不同，开 DEBUG 看结构
      log("context matched but no code field found; set DEBUG=true to inspect (URL=" + url + ")");
      DONE({});
    }
  } catch (e) {
    log("err " + e);
    DONE({});   // 任何异常退化为原样放行
  }
})();
