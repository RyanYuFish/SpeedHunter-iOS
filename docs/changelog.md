# Changelog

## 2026-10-28 — ZeehoCustomKey：自定义键映射为「切换信息组」（新增脚本 #3）

- 新增 `scripts/ZeehoCustomKey.js`（`type=http-request`）：在 `dbpoint/send` 请求**离机前**把
  `commandCode` 强制改写为 **7（切换信息组）** → 车端 `SetItem4` 落入 7，仪表主页按自定义键在
  「里程组 ⇄ 胎压组」间切换，首页显示前后轮胎压 / 胎温。
- 机制与 Android 端 SpeedHunter v4.7/v4.7.1 的 `customkey` 包完全一致：该设置项**恒走 4G 云端**
  （`dbpoint/send` 通用网关），实测从不走 BLE。
- 依赖既有 `[MITM] hostname = %APPEND% tapi.zeehoev.com` —— 已有配置无需改动即可解密。
- `conf/Zeeho.conf` 与 `conf/Zeeho.conf.example` 的 `[Script]` 段新增 `ZeehoCustomKey` 条目
  （默认 `enable=true`）：**启用 = 映射生效，禁用 = 原样放行、零副作用**。
- 安全设计：仅当请求体命中自定义键上下文（`commandCode` / `customKey` / `SetItem` 等标记）才改写，
  避免误伤其余 `dbpoint/send` 调用；非 JSON 或任何异常一律退化为原样放行。
  `DEBUG`（默认 `false`）打开后可打印命中请求体，用于确认真实字段结构。

## 2026-10-24 — 项目重整为 SpeedHunter-iOS
- 由 `iOS-rocket` 更名为 `SpeedHunter-iOS`；生产脚本留 `scripts/`，调试脚本归集 `scripts/debug/`（仅 `ZeehoDebug.js`）；
- `conf/Zeeho.conf` 含个人证书、git-ignored，仅提交脱敏 `conf/Zeeho.conf.example`；README 改为简体中文为主。

## 2026-10-04 — ZeehoRideFill v15
- 别名 `PS/REQ/RES/DONE` 规避 `$` 被配置吞掉；各 API handler 独立 try-catch；
- 压弯阈值下放，DEBUG 默认关闭。

## 2026-09-28 — ZeehoVehicleType 定稿
- 8 轮消融（R0–R7）结论：仅改 `vehicleKinds=2` + `cyclingEventStatisticFlag=true`；
- 移除 F3/F4/F5，`vehicleType` 保持服务端原值。
