/*
 * ZeehoOTA.js —— red-point 重放：让 App 无视当前固件版本显示 OTA 升级（平刷用）
 *
 * 原理：服务端在无升级任务时返回 {"status":0,"fileInfoList":null}，App 因此不显示 OTA。
 * 本脚本把这个响应改写为客服推送时抓到的真实 status:11 载荷（不是伪造：
 * fileName/fileUrl/sign/fileSize 全部来自服务端下发原文，MD5 与本地留档包一致，
 * 见 firmware/red-point-response-145141.log）。
 *
 * 状态机依据：仪表端更新脚本只做 part_sizes 校验 + 逐分区 MD5 回读，无版本比较
 * → 同版本平刷在车端校验层面可通（见 ../../docs/07-固件包结构.md）。
 *
 * ⚠️ 跨车型风险：REPLAY 目前是 AE5i(TDQ0200Z) 的包；目标是 AE5i Pro(TDQ0203Z)。
 *    pq/tcon/pat_logo/GD32_APP 分区跨车型可能不适配，车端不会拦。首选让客服给
 *    …43678 推它自己的包后，只替换下面 REPLAY 六行元数据。
 */

// ===== 开关 =====
var ENABLED = false;                  // 总开关，平时必须 false
var TARGET_VIN = "358122500143678";   // 只处理这台车的请求；"" = 不限制

// ===== 重放载荷（来自真实下发原文，换包时只改这里）=====
var REPLAY = {
  status: 11,
  title: "发现新的OTA升级",
  content: "车辆仪表升级",
  preDownloadAppSet: true,
  fileInfoList: [{
    fileName: "1787815351970919959.zip",
    fileUrl: "https://oss-cfmoto-private.zeehoev.com/ota-package/ota1/2026/08/27/1787815351970919959.zip",
    sign: "a4087521c4855e32cf4a762d563eccce",
    fileSize: "106239802",
    firmwareId: "5653",
    fileBucket: "wlb-cfmoto-private"
  }],
  multiDownloadUpgradeContent: null
};

function log(s) { console.log("[ZeehoOTA] " + s); }

(function () {
  if (!ENABLED) { $done({}); return; }

  var url = $request.url || "";
  if (url.indexOf("red-point/content") < 0) { $done({}); return; }
  if (TARGET_VIN && url.indexOf("vinNo=" + TARGET_VIN) < 0) { $done({}); return; }

  try {
    var obj = JSON.parse($response.body || "");
    var d = obj.data;
    if (!d) { $done({}); return; }

    log("OLD status=" + d.status
      + " fileInfoList=" + (d.fileInfoList ? "present" : "null"));

    // 已有真实升级任务时不覆盖，避免干扰正常 OTA
    if (d.status === 11 && d.fileInfoList) {
      log("server already has task, skip");
      $done({});
      return;
    }

    obj.data = JSON.parse(JSON.stringify(REPLAY));
    log("REPLAYED status=11 firmwareId=" + REPLAY.fileInfoList[0].firmwareId);
    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    log("err " + e);
    $done({});
  }
})();
