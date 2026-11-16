/*
 * ZeehoVehicleModel.js — 主页车模替换（车型 / 颜色自由切换）
 *
 * 用法：改下面 ART_PIC_2D / ART_PIC_3D 两个变量（按需留空），保存后重启 Shadowrocket
 * 脚本（或直接在 App 内下拉刷新主页）。规则拦 vehicleHomePageV2 / vehicle/list。
 *
 * 依据（v3.0.5 DEX 反查 + 实采 netdump）：
 *   - MyCarHomePageRsp.getVehiclePicUrl     → 主页 2D 车图（PNG）
 *   - MyCarHomePageRsp.getVehiclePic3dUrl   → 3D 车模（glb，CFFilamentView#loadUrl 按 URL 加载；
 *                                             颜色由 glb 内嵌材质决定 —— ZeehoModelProcessor
 *                                             的 carColorMaterials[carColorIndex]）
 *   - MyCarHomePageRsp.getVehicleScalePicUrl → 同 PNG + OSS resize 参数（缩略图）
 *   - APK assets/3d 只有 Filament 材质，无内置车模 ⇒ 换 URL 即换车
 *
 * URL 来源建议：另一辆车主页抓包的 vehiclePicUrl（oss-cfmoto.zeehoev.com media PNG），
 * 或 zhoodash cmdModels 下载的 .glb 的可访问 URL。
 */

// ★ 两个手动填写的变量 ★
var ART_PIC_2D = "";   // 2D 车图 URL（PNG）；留空 = 不替换 2D
var ART_PIC_3D = "";   // 3D 车模 URL（glb）；留空 = 不替换 3D
// 可选：主题色（如 "#131415"）替换 appThemeRgb（主页氛围色）；留空不动
var ART_THEME_RGB = "";

// 实采 vehicleScalePicUrl 的 OSS 缩放参数（AE5i / AE7 一致）
var OSS_RESIZE = "?x-oss-process=image/resize,m_fixed,w_500,h_315";

function log(s) { console.log("[ZeehoVM] " + s); }

function patch(v) {
  if (!v || typeof v !== "object") return;

  if (ART_PIC_2D && v.vehiclePicUrl !== undefined) {
    log("pic OLD " + v.vehiclePicUrl + " -> " + ART_PIC_2D);
    v.vehiclePicUrl = ART_PIC_2D;
  }
  if (ART_PIC_3D && v.vehiclePic3dUrl !== undefined) {
    log("pic3d OLD " + v.vehiclePic3dUrl + " -> " + ART_PIC_3D);
    v.vehiclePic3dUrl = ART_PIC_3D;
  }
  if (ART_PIC_2D && v.vehicleScalePicUrl !== undefined) {
    // 保留原 OSS 处理参数，没有则补默认缩放
    var q = String(v.vehicleScalePicUrl).indexOf("?");
    var suffix = q >= 0 ? String(v.vehicleScalePicUrl).substring(q) : OSS_RESIZE;
    v.vehicleScalePicUrl = ART_PIC_2D + suffix;
  }
  if (ART_THEME_RGB && v.appThemeRgb !== undefined) {
    log("rgb OLD " + v.appThemeRgb + " -> " + ART_THEME_RGB);
    v.appThemeRgb = ART_THEME_RGB;
  }
}

(function () {
  if (!ART_PIC_2D && !ART_PIC_3D && !ART_THEME_RGB) {
    // 什么都没填：直接放行（零开销）
    $done({});
    return;
  }
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
    log("patched " + url);
    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    log("err " + e);
    $done({});
  }
})();
