# Changelog

## 2026-10-04 — ZeehoRideFill v15
- 全局别名 `PS/REQ/RES/DONE`，杜绝 `$` 被配置吞掉导致的语法错误；
- 每个 API handler 独立 try-catch，互不牵连；JSON.parse 外层兜底，非 JSON 直接透传；
- `readDay/writeDay` 内部 try-catch，store 不可用时降级；
- `DEBUG` 默认 `false`，避免 debugPrint 重算导致超时；`C.LOG` 保持 `true`；
- 压弯参数微调：BEND_V_MIN 25→20、BEND_V_MAX 60→80、BEND_SEED 10→5、BEND_CUM_MIN 30→15、BEND_ALLOW_GAP / BEND_MERGE_GAP 1→0。

## 2026-10-04 — ZeehoDebug.conf
- 补 `ZeehoProbe`（全量探针）、`ZeehoCalibProbe`（标定探针）、`ZeehoClearStore`（清缓存）三条默认禁用条目；
- `ZeehoVehicleType` / `ZeehoRideFill` 设为默认启用。

## 2026-09-28 — ZeehoVehicleType 定稿（最小充分集 F1+F2）
- 8 轮消融（R0–R7）结论落地：仅改 `vehicleKinds=2` + `cyclingEventStatisticFlag=true`；
- 移除 F3(`regulationType`) / F4(`vehType`) / F5(`vehicleType` 三件套)，`vehicleType` 保持服务端原值（AE5i Pro）。

## 2026-09-28 — ZeehoOTA（占位，默认禁用）
- 红点重放：把无任务的 `red-point/content` 响应改写为真实 `status:11` 载荷，用于同版本平刷；
- 仅处理目标 VIN，已有真实升级任务时不覆盖；跨车型风险高，默认 `ENABLED=false`。
