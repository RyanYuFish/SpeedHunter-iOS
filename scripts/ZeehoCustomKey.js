/*
 * ZeehoCustomKey.js
 * 自定义键强制为「切换信息组（功能码 7）」—— iOS 端 Shadowrocket 等价实现，
 * 对齐 Android SpeedHunter 的 customkey.CustomKeyForce。
 *
 * 与 Android 模块一致的核心约束（见 CustomKeyForce.java）：
 *   - 只改写 commandCode 一个 int 字段（车端 SetItem4+0x0f 落入 7 → 仪表切信息组）；
 *   - functionCode / buttonType 是显示名（字符串），绝不改动，App 界面仍显示用户点的卡片；
 *   - 命中「含 commandCode 的保存请求」才改写，其余请求原样放行；
 *   - 整段包 try/catch，任何异常退化为原样放行，绝不阻断保存。
 *
 * iOS 差异：无法像 Xposed 那样 hook 内存里的 CustomButtonCode 对象，只能拦截离机前的
 * HTTP 请求改写。本脚本在请求体（含 dbpoint/send 的嵌套 param JSON 字符串）里查找
 * commandCode 数值字段并改为 TARGET，保持 int 类型。
 *
 * 开关行为（满足「启用脚本则映射、关闭脚本则不修改」）：
 *   在 Shadowrocket 里【启用】本脚本 = 映射生效；【禁用】本脚本 = 完全不改写（原样发出）。
 *   关闭脚本时本文件根本不执行，零副作用。
 *
 * 安全边界：
 *   - 仅当请求体含 commandCode 数值字段时才改写；
 *   - 整段包 try/catch，任何异常退化为「原样放行」，绝不阻断保存；
 *   - 默认 DEBUG=false，不打印请求体（日志可能含 VIN / 账号等敏感字段）。
 */

// ===== 可调参数 =====
var DEBUG = false;          // 改为 true 可在 Shadowrocket 日志里看到命中的请求体（用于确认字段/路径）
var TARGET = 7;             // 切换信息组功能码

var REQ = $request;
var DONE = $done;

var TAG = "[ZeehoKey] ";

// 只针对 commandCode（int）。functionCode 是名字串，不在此列（与 Android 一致）。
// keyCode / buttonCode 作为数值型兄弟字段一并覆盖（防御不同命名）。
var CODE_KEY_HINTS = ["commandcode", "keycode", "buttoncode"];

function log(s) { console.log(TAG + s); }

// 归一化：小写 + 剥掉 _ - 空格，让 commandCode / command_code 等价
function norm(s) { return ("" + s).toLowerCase().replace(/[_\-\s]/g, ""); }

function isCodeKey(k) {
  var s = norm(k);
  for (var i = 0; i < CODE_KEY_HINTS.length; i++) {
    if (s.indexOf(CODE_KEY_HINTS[i]) >= 0) return true;
  }
  return false;
}

// 递归查找并改写 commandCode 数值字段；返回是否命中
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
    var v = obj[k];
    if (isCodeKey(k)) {
      // 仅对数值型 code 改写；保持 int（Android 用 setInt，commandCode 恒为 int）
      if (typeof v === "number") {
        if (v !== TARGET) {
          log("commandCode " + v + " -> " + TARGET + "（切换信息组）");
          obj[k] = TARGET;
        }
        hit = true;
      } else if (typeof v === "string") {
        // 防御：后端误发字符串型 code（如 "7"）则保持字符串；非数字串（名字）跳过
        var n = parseInt(v, 10);
        if (!isNaN(n)) {
          if (n !== TARGET) {
            log("commandCode \"" + v + "\" -> \"" + TARGET + "\"（切换信息组）");
            obj[k] = "" + TARGET;
          }
          hit = true;
        }
        // 非数字字符串（如 functionCode 的 "VEHICLE_SET"）一律不动
      }
    } else if (typeof v === "object" && v !== null) {
      if (rewrite(v)) hit = true;
    } else if (typeof v === "string" && (v.charAt(0) === "{" || v.charAt(0) === "[")) {
      // 嵌套 JSON 字符串（如 dbpoint/send 的 param 字段）：解析后递归改写再回写
      try {
        var sub = JSON.parse(v);
        if (rewrite(sub)) {
          obj[k] = JSON.stringify(sub);
          hit = true;
        }
      } catch (e) { /* 不是 JSON，忽略 */ }
    }
  }
  return hit;
}

(function () {
  var url = (REQ && REQ.url) || "";
  var body = (REQ && REQ.body) || "";
  try {
    if (!body) { DONE({}); return; }
    var obj;
    try { obj = JSON.parse(body); } catch (e) { DONE({}); return; }

    if (DEBUG) log("URL=" + url + " BODY=" + body.slice(0, 4000));

    var changed = rewrite(obj);
    if (changed) {
      log("mapped custom-key -> switch-info (7) at " + url);
      DONE({ body: JSON.stringify(obj) });
    } else {
      // 无 commandCode 字段：不是自定义键保存，原样放行
      if (DEBUG) log("no commandCode field; pass-through (URL=" + url + ")");
      DONE({});
    }
  } catch (e) {
    log("err " + e);
    DONE({});   // 任何异常退化为原样放行
  }
})();
