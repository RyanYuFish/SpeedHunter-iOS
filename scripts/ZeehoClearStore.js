/*
 * ZeehoClearStore.js —— 占位模板（默认禁用）
 *
 * 用途：清空本模块写入的 $persistentStore 日聚合缓存（zeeho_day_*）。
 *       debugging 时若发现回填数值异常，可临时启用本脚本清缓存后重抓。
 *
 * 启用方式：在 Shadowrocket 配置的 [Script] 段将对应条目的 enable=false 改为 true。
 * 注意：启用后会对所有 tapi.zeehoev.com 响应执行清空，仅调试短期开启。
 */

(function () {
  try {
    // 仅占位：真实实现应遍历并删除 zeeho_day_* 键
    console.log("[ZeehoClearStore] stub — no-op (placeholder)");
  } catch (e) {
    console.log("[ZeehoClearStore] err " + e);
  }
  $done({});
})();
