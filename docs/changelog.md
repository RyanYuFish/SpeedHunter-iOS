# Changelog

## 2026-10-24 — 项目重整为 SpeedHunter-iOS
- 由 `iOS-rocket` 更名为 `SpeedHunter-iOS`；生产脚本留 `scripts/`，调试脚本归集 `scripts/debug/`（仅 `ZeehoDebug.js`）；
- `conf/Zeeho.conf` 含个人证书、git-ignored，仅提交脱敏 `conf/Zeeho.conf.example`；README 改为简体中文为主。

## 2026-10-04 — ZeehoRideFill v15
- 别名 `PS/REQ/RES/DONE` 规避 `$` 被配置吞掉；各 API handler 独立 try-catch；
- 压弯阈值下放，DEBUG 默认关闭。

## 2026-09-28 — ZeehoVehicleType 定稿
- 8 轮消融（R0–R7）结论：仅改 `vehicleKinds=2` + `cyclingEventStatisticFlag=true`；
- 移除 F3/F4/F5，`vehicleType` 保持服务端原值。
