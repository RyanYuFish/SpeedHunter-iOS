/*
 * ZeehoCalibProbe.js —— 占位模板（默认禁用）
 *
 * 用途：标定探针。抓取 ridetrack_v2 / myRideInfo / homeRideInfo / analyse
 *       的响应体并打印，用于核对轨迹估算与回填参数（见 ZeehoRideFill.js 顶部 C 参数）。
 *
 * 启用方式：在 [Script] 段将 enable=false 改为 true；调试完成后改回或删除。
 * 日志位置：Shadowrocket → 配置 → 脚本 → 日志。
 */

(function () {
  try {
    var body = $response && $response.body ? $response.body : "";
    console.log("[ZeehoCalibProbe] url=" + (($request && $request.url) || "") +
      " bodyLen=" + body.length);
    // 占位：真实实现可在此解析 JSON 并打印关键字段用于标定
  } catch (e) {
    console.log("[ZeehoCalibProbe] err " + e);
  }
  $done({});
})();
