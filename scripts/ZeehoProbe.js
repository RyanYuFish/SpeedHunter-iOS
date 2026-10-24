/*
 * ZeehoProbe.js —— 占位模板（默认禁用）
 *
 * 用途：全量探针。捕获所有 *.zeehoev.com 的响应，打印 URL 与 body 长度，
 *       用于在接入阶段确认 App 实际请求的接口路径与字段，便于扩展脚本。
 *
 * 启用方式：在 [Script] 段将 enable=false 改为 true。该脚本仅记录、不改写响应。
 */

(function () {
  try {
    var url = ($request && $request.url) || "";
    var body = $response && $response.body ? $response.body : "";
    console.log("[ZeehoProbe] url=" + url + " bodyLen=" + body.length);
  } catch (e) {
    console.log("[ZeehoProbe] err " + e);
  }
  $done({});
})();
