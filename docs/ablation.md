# iOS 端 UI 闸门消融实验（R0–R7）

> 完整过程与结果见仓库根目录 `ablation/`（**本地工作目录，已被 `.gitignore` 忽略，不入库**）。

**结论：iOS 端最小充分集 = F1 + F2**，已落地到 `scripts/ZeehoVehicleType.js`。

| 代号 | 字段 | 效果 |
| :--- | :--- | :--- |
| F1 | `vehicleKinds = 2` | 「骑行分析」入口 + 极速 |
| F2 | `cyclingEventStatisticFlag = true` | 加速 / 急刹 / 压弯 |
| F3 / F4 / F5 | `regulationType` / `vehType` / `vehicleType` 三件套 | 经验证对 UI 无效，已移除 |

消融实验矩阵（O0..O4 = UI 观测点）：

| 轮 | MODE | O0 | O1 | O2 | O3 | O4 |
| :-- | :--- | :- | :- | :- | :- | :- |
| R0 | none | 0 | 0 | 0 | 0 | 0 |
| R1 | all | 1 | 1 | 1 | 1 | 1 |
| R2 | F1 | 1 | 1 | 0 | 0 | 0 |
| R3 | F2 | 0 | 0 | 1 | 1 | 1 |
| R4 | F3 | 0 | 0 | 0 | 0 | 0 |
| R5 | F4 | 0 | 0 | 0 | 0 | 0 |
| R6 | F5 | 0 | 0 | 0 | 0 | 0 |
| R7 | all-F2 | 1 | 1 | 0 | 0 | 0 |

R2 证 F1 管入口/极速，R3 证 F2 管事件统计；R4–R6 单开 F3/F4/F5 全为 0，R7 去掉 F2 后事件消失 → F2 为事件显示唯一来源。`vehicleType` 保持服务端原值。
