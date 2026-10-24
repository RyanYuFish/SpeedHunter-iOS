/*
 * ZeehoVehicleType.ablation.js
 * 消融实验版：与原版 ZeehoVehicleType.js 行为一致，仅两处不同：
 *   1. 字段开关集中到顶部一个 MODE 常量，每轮实验只改这一行；
 *   2. 所有被改字段（含原版没记录的 vehicleType 三件套）都先打 OLD 日志再改，
 *      补上 F5 的原值盲点。
 * 用法见 ../../docs/03-iOS消融实验-计划.md。
 */

// ===== 每轮实验只改这里 =====
// "none"     全关（基线 R0）
// "all"      全开（复现 R1）
// "F1".."F5" 只开一个字段（加法轮 R2-R6）
// "all-F2"   全开但去掉某字段（减法轮 R7-R11）
// "F2+F4"    组合轮（R12）
var MODE = "all";
// ==========================

function log(s) { console.log("[ZeehoVT] " + s); }

function activeIds() {
  if (MODE === "none") return [];
  if (MODE === "all") return ["F1", "F2", "F3", "F4", "F5"];
  if (MODE.indexOf("all-") === 0) {
    var off = MODE.slice(4).split("+");
    return ["F1", "F2", "F3", "F4", "F5"].filter(function (f) { return off.indexOf(f) < 0; });
  }
  return MODE.split("+");
}

function on(id) { return activeIds().indexOf(id) >= 0; }

function patch(v) {
  if (!v || typeof v !== "object") return;

  if (on("F1") && v.vehicleKinds !== undefined) {
    log("F1 OLD vehicleKinds=" + v.vehicleKinds);
    v.vehicleKinds = 2;
  }

  if (on("F2") && v.cyclingEventStatisticFlag !== undefined) {
    log("F2 OLD cyclingEventStatisticFlag=" + v.cyclingEventStatisticFlag);
    v.cyclingEventStatisticFlag = true;
  }

  if (on("F5")) {
    // 原版没打 OLD，这里补上 —— F5 的原值是当前唯一盲点
    log("F5 OLD vehicleType=" + v.vehicleType
      + " vehicleTypeName=" + v.vehicleTypeName
      + " vehicleTypeDetailId=" + v.vehicleTypeDetailId);
    v.vehicleType = "AE8";
    v.vehicleTypeName = "YD800DQT";
    v.vehicleTypeDetailId = 471;
  }

  if ((on("F3") || on("F4")) && Array.isArray(v.iotProperties)) {
    v.iotProperties.forEach(function (p) {
      if (p.identify !== "vehicleTypeInfo" || typeof p.value !== "string") return;
      var info;
      try { info = JSON.parse(p.value); } catch (e) { log("parse err " + e); return; }
      if (on("F3")) { log("F3 OLD regulationType=" + info.regulationType); info.regulationType = 1; }
      if (on("F4")) { log("F4 OLD vehType=" + info.vehType); info.vehType = 1; }
      p.value = JSON.stringify(info);
    });
  }
}

(function () {
  var url = $request.url || "";
  if (url.indexOf("/vehicleHomePageV2") < 0 &&
      url.indexOf("/vehicle/list") < 0) {
    $done({});
    return;
  }
  try {
    var obj = JSON.parse($response.body || "");
    var data = obj.data;
    if (!data) { $done({}); return; }
    if (Array.isArray(data)) data.forEach(patch);
    else patch(data);
    log("MODE=" + MODE + " patched " + url);
    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    log("err " + e);
    $done({});
  }
})();
