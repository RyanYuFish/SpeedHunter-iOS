# SpeedHunter iOS

iOS 端 Shadowrocket 模块与脚本集合，通过对少量 HTTP 响应做 MITM 改写，恢复 ZEEHO App 被服务端隐藏的骑行记录能力。仅用于个人设备的兼容性研究与界面还原。**与 ZEEHO / CFMOTO 无任何隶属、授权或合作关系。**

## 功能

| # | 脚本 | 说明 |
| :-- | :--- | :--- |
| 1 | **ZeehoVehicleType** | UI 能力闸门：在 `vehicleHomePageV2` / `vehicle/list` 设置 `vehicleKinds = 2` + `cyclingEventStatisticFlag = true` → 显示「骑行分析」入口、极速、加速/急刹/压弯。 |
| 2 | **ZeehoRideFill** | 由 `ridetrack_v2` 轨迹点估算急刹与压弯次数，用按日缓存回填 `myRideInfo` / `homeRideInfo` / `analyse`。 |
| 3 | **ZeehoCustomKey** | 自定义键映射：在 `dbpoint/send` 请求**离机前**把 `commandCode` 强制改写为 **7（切换信息组）** → 仪表主页按自定义键在「里程组 ⇄ 胎压组」间切换，显示前后轮胎压 / 胎温。 |

> **切换语义（#3）**：**启用**脚本 = 所有自定义键设置都被映射为「切换信息组」；**禁用**脚本 = 完全不改写请求，App 行为恢复原厂、零副作用。

## 消融实验

8 轮消融（R0–R7）证明 iOS 端最小充分集为 **F1 + F2**；`regulationType`(F3)、`vehType`(F4)、`vehicleType` 三件套(F5) 均冗余已移除，`vehicleType` 保持服务端原值。详见 [docs/ablation.md](docs/ablation.md)。

## 使用前准备

- Shadowrocket 已开启 **HTTPS 解密（MITM）** 并装有可用 CA 证书；
- 导入配置并启用脚本。

## 配置步骤

```bash
# 1. 复制模板并填入你自己的 MITM 证书
cp conf/Zeeho.conf.example conf/Zeeho.conf
#   → 编辑 conf/Zeeho.conf 的 [MITM] ca-p12 + ca-passphrase

# 2. 在 Shadowrocket 中导入 conf/Zeeho.conf，开启 HTTPS 解密，
#    并启用 ZeehoVehicleType 与 ZeehoRideFill 两个脚本。
```

`conf/Zeeho.conf` 已被 `.gitignore` 忽略（含个人证书）；仅脱敏的 `conf/Zeeho.conf.example` 入库。

## 项目结构

```
SpeedHunter-iOS/
├── conf/
│   ├── Zeeho.conf.example   # 脱敏模板（入库）
│   └── Zeeho.conf           # 个人配置（git-ignored）
├── scripts/
│   ├── ZeehoVehicleType.js  # 生产：F1+F2 gate
│   ├── ZeehoRideFill.js     # 生产：轨迹估算+回填
│   ├── ZeehoCustomKey.js    # 生产：自定义键→切换信息组（http-request 改写）
│   └── debug/
│       └── ZeehoDebug.js    # 调试探针（默认禁用）
├── docs/
│   ├── ablation.md
│   └── changelog.md
├── LICENSE
└── .gitignore
```

调试探针 `ZeehoDebug.js` 只记录、不改写响应，默认禁用，按需启用。

## 安全与隐私

- 不上传骑行记录、车辆信息、位置或账号数据；不修改 App、不绕过账号权限、不改变车辆控制逻辑；
- 速度/事件数据仅用于界面显示，不能替代仪表或作为安全决策依据；**骑行时勿操作手机，也不要依赖本模块读数**；
- 日志可能含 VIN、骑行记录、账号字段等个人信息——妥善保管且切勿提交（见 `.gitignore`）。

## 非官方声明与许可

本项目与 ZEEHO、CFMOTO 及其关联方无任何隶属、授权、赞助或合作关系。相关名称与图标归各自权利人所有。本项目仅用于个人设备的兼容性研究与界面还原，不提供官方支持，也不保证持续兼容。用户须确保对目标设备拥有合法使用权并遵守当地法律与厂商保修政策。

原始代码与文档基于 **AGPL-3.0** 许可；该许可不适用于通过 ZEEHO / CFMOTO 接口获取的 App 数据、商标或内容。
