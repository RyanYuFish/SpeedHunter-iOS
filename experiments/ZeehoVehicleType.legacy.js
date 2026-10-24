/*
 * ZeehoVehicleType.js
 * 单脚本版本：改所有候选车型/能力字段
 */

var url = $request.url || "";
var raw = $response.body || "";

function log(s) { console.log("[ZeehoVT] " + s); }

function patch(v) {
  if (!v || typeof v !== "object") return;

  if (v.vehicleType)       v.vehicleType = "AE8";
  if (v.vehicleTypeName)   v.vehicleTypeName = "YD800DQT";
  if (v.vehicleTypeDetailId !== undefined) v.vehicleTypeDetailId = 471;

  // 新增候选 1：车辆大类
  if (v.vehicleKinds !== undefined) {
    log("OLD vehicleKinds=" + v.vehicleKinds);
    v.vehicleKinds = 2;
  }
  // 新增候选 2：骑行事件统计标志
  if (v.cyclingEventStatisticFlag !== undefined) {
    log("OLD cyclingEventStatisticFlag=" + v.cyclingEventStatisticFlag);
    v.cyclingEventStatisticFlag = true;
  }

  if (Array.isArray(v.iotProperties)) {
    v.iotProperties.forEach(function(p) {
      if (p.identify === "vehicleTypeInfo" && typeof p.value === "string") {
        log("OLD vehicleTypeInfo=" + p.value);
        try {
          var info = JSON.parse(p.value);
          info.regulationType = 1;
          info.vehType = 1;
          p.value = JSON.stringify(info);
          log("NEW vehicleTypeInfo=" + p.value);
        } catch (e) { log("parse err " + e); }
      }
    });
  }
}

(function() {
  if (url.indexOf("/vehicleHomePageV2") < 0 &&
      url.indexOf("/vehicle/list") < 0) {
    $done({});
    return;
  }
  try {
    var obj = JSON.parse(raw);
    var data = obj.data;
    if (!data) { $done({}); return; }
    if (Array.isArray(data)) data.forEach(patch);
    else patch(data);
    log("patched " + url);
    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    log("parse err " + e);
    $done({});
  }
})();