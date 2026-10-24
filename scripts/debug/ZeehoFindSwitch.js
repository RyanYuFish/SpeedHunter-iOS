/*
 * ZeehoWidgetsProbe.js
 * 只抓 vehicle/widgets 完整响应，不改写
 */

var url = $request.url || "";
var raw = $response.body || "";

function log(msg) {
  console.log("[ZeehoWidgetsProbe] " + msg);
}

if (url.indexOf("/vehicle/widgets") >= 0) {
  log("URL=" + url);
  log("LEN=" + raw.length);

  // 提取顶层字段名和"像开关"的字段
  try {
    var obj = JSON.parse(raw);
    var data = obj.data || obj;
    var keys = Object.keys(data);
    log("DATA_KEYS=" + JSON.stringify(keys));

    var flags = {};
    keys.forEach(function(k) {
      var v = data[k];
      if (v === true || v === false || v === null ||
          v === 0 || v === 1 || v === "0" || v === "1") {
        flags[k] = v;
      }
    });
    log("FLAGS=" + JSON.stringify(flags));
  } catch (e) {
    log("PARSE_ERR=" + e);
  }

  // 分段打印完整 body
  var CHUNK = 3000;
  var idx = 0;
  var part = 0;
  while (idx < raw.length) {
    log("P" + part + "=" + raw.substring(idx, idx + CHUNK));
    idx += CHUNK;
    part++;
  }
}

$done({});