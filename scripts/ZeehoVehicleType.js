/*
 * ZeehoVehicleType.min.js —— 消融实验定稿版（2026-09-28）
 *
 * 8 轮消融（R0-R7）结论：iOS 端只有两个独立 gate，最小充分集 = F1 + F2：
 *   F1  vehicleKinds = 2                 → 「骑行分析」入口 + 极速 显示
 *   F2  cyclingEventStatisticFlag = true → 加速 / 急刹 / 压弯 显示
 * F3(regulationType) / F4(vehType) / F5(vehicleType 三件套) 已证实冗余，全部移除
 * —— vehicleType 保持服务端原值（AE5i Pro），App 不再误认车型。
 *
 * 依据：iOS-rocket/ablation-test/ABLATION-RESULTS.md
 */

function log(s) { console.log("[ZeehoVT] " + s); }

function patch(v) {
  if (!v || typeof v !== "object") return;

  if (v.vehicleKinds !== undefined) {
    log("F1 OLD vehicleKinds=" + v.vehicleKinds);
    v.vehicleKinds = 2;
  }

  if (v.cyclingEventStatisticFlag !== undefined) {
    log("F2 OLD cyclingEventStatisticFlag=" + v.cyclingEventStatisticFlag);
    v.cyclingEventStatisticFlag = true;
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
    log("MODE=min(F1+F2) patched " + url);
    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    log("err " + e);
    $done({});
  }
})();