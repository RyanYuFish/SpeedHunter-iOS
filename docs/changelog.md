# Changelog

## 2026-11-12 — ZeehoCustomKey 重做：改包体 + 重算签名（修复「保存不生效」）

- **定位到真实写入点**（App 3.1.0 实抓）：自定义按键保存走
  `PUT /v1.0/app/cfmotoserverapp/vehicleSet/propertyOne/one`，
  体为 `{"relatedFunctions":{},"commond":"142","version":"v2","commondParam":"1","vcu":"<VIN>"}`
  ——`commond` 是设置项 ID，`commondParam` 才是功能码。旧脚本盯的 `commandCode`
  与 `dbpoint/send` 在这条链路上根本不存在，故一直空转。
- **关键修复**：云 API 的 `cfmoto-x-sign` 覆盖请求体
  （`MD5(hex(SHA-1(sortedQuery + body + cfmoto-x-param + secret)))`），
  Shadowrocket 在传输层改包体后原签名即失效、服务端会拒。脚本内置纯 JS 的
  MD5/SHA-1，改写后重算 `cfmoto-x-sign` 与 `signature` 两个头。
- 脚本改为只拦 `vehicleSet/propertyOne` 且 `commond` ∈ `ITEM_IDS`（默认 `["142"]`），
  仅改 `commondParam` 一个字段；无可重算签名时放弃改写、原样放行。
- 新增 `scripts/debug/ZeehoSetProbe.js`（`type=http-response`，默认禁用）：
  打印 `itemsV2` / `vehicleSetInfo` / `propertyOne` 响应，用于确证设置项 ID 与保存结果。
- 配置：`ZeehoCustomKey` pattern 收窄为 `.*tapi\.zeehoev\.com.*vehicleSet/propertyOne.*`，
  新增 `ZeehoSetProbe` 条目。

## 2026-11-12 — ZeehoAccountToken：自动提取登录凭证（新增脚本 #4）

- 新增 `scripts/ZeehoAccountToken.js`（`type=http-request`）：从 ZEEHO 请求 URL /
  请求头自动提取 `token`（`token` / `access_token` / `satoken` / `h5_token` 参数或
  `Authorization: Bearer` / `x-token` / `access-token` 头）与账号 ID
  （`userId` / `userid` / `user_id` / `uid` / `accountId` 参数），写入
  `$persistentStore`（`zeeho_token` / `zeeho_userid`）并打印可复制的一行。
- **替代原先做法**：之前靠手工翻 `logs/successPacketTunnel-*.log`、从 URL 里找字段
  再复制填入；现在打开极核 App 进一次「我的 → 签到」即可在脚本日志里拿到。
- 只读、不改写请求（`$done({})`）；禁用脚本即完全不采集，零副作用。
  日志里 token 默认打码，需明文复制时把 `PRINT_FULL_TOKEN` 改为 `true`，用完改回。
- `conf/Zeeho.conf` 与 `conf/Zeeho.conf.example`：`[Script]` 加 `ZeehoAccountToken`
  条目（默认 `enable=true`），`[MITM] hostname` 追加 `h5.zeehoev.com`
  （H5 签到页 URL 需解密才能读到 token）。既有脚本与证书配置不变。
- 用途：尚未明确。

## 2026-10-28 — ZeehoCustomKey：自定义键映射为「切换信息组」（新增脚本 #3）

> 已被上方 2026-11-12 条目取代：`dbpoint/send` + `commandCode` 的判断不成立，
> 真实写入点是 `vehicleSet/propertyOne` 的 `commondParam`。

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
