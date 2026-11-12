/*
 * ZeehoSetProbe.js —— 车辆设置接口响应探针（只读，不改任何响应）
 *
 * 用途：确证「自定义按键」在云端设置项里的身份与取值。
 *   - vehicleSet/itemsV2        → 设置项清单：每项的 commond（设置项 ID）/ 名称 / 可选项 / 当前值
 *   - vehicleSet/vehicleSetInfo → 当前生效的车辆设置快照
 *   - vehicleSet/propertyOne    → 单属性写入结果（成功 / 失败原因）
 *
 * 用法（Shadowrocket → 配置 → 添加 [Script] 条目，type=http-response）：
 *   ZeehoSetProbe = type=http-response,engine=jsc,script-path=scripts/debug/ZeehoSetProbe.js,\
 *     pattern=.*tapi\.zeehoev\.com.*vehicleSet/(itemsV2|vehicleSetInfo|propertyOne).*,\
 *     max-size=0,requires-body=true,timeout=30,script-update-interval=0,enable=false
 *
 * 探针在 App「车辆设置 → 自定义按键 → 选一个 → 保存」期间启用，抓完即关。
 * 日志可能含 VIN / 账号字段，勿长期开启、勿外传。
 */

var RES = $response;
var REQ = $request;
var DONE = $done;

var LIMIT = 8000;          // 单条最多打印字符数，避免超大响应刷屏
var TAG = "[SetProbe] ";

(function () {
  try {
    var url = (REQ && REQ.url) || "";
    var body = (RES && RES.body) || "";
    var code = (RES && RES.status) || "";

    // 只留接口名，去掉 query（含 VIN）以缩短日志
    var short = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    var text = body.length > LIMIT ? body.slice(0, LIMIT) + "…<truncated>" : body;

    console.log(TAG + "status=" + code + " " + short + " RESP=" + text);
  } catch (e) {
    console.log(TAG + "err " + e);
  }
  DONE({});    // 原样返回，绝不修改响应
})();
