# iOS 端 UI 闸门消融实验（R0–R7）

> 目标：确定 iOS 端让 ZEEHO App 显示完整骑行分析所需的最小字段集合。
> 结论：**最小充分集 = F1 + F2**；F3 / F4 / F5 冗余，已全部移除。

## 候选字段

| 代号 | 字段 | 期望效果 |
| :--- | :--- | :--- |
| F1 | `vehicleKinds = 2` | 「骑行分析」入口 + 极速显示 |
| F2 | `cyclingEventStatisticFlag = true` | 加速 / 急刹 / 压弯显示 |
| F3 | `iotProperties.vehicleTypeInfo.regulationType = 1` | （假定）车型合规类型 |
| F4 | `iotProperties.vehicleTypeInfo.vehType = 1` | （假定）车辆大类 |
| F5 | `vehicleType / vehicleTypeName / vehicleTypeDetailId` | （假定）车型三件套 |

## 实验矩阵

`O0..O4` = 四个 UI 观测点是否出现；`Q1/Q2` = 次级观测；`MODE` = 实际生效的字段集。

| 轮 | O0 | O1 | O2 | O3 | O4 | Q1 | Q2 | MODE |
| :-- | :- | :- | :- | :- | :- | :- | :- | :--- |
| R0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | none |
| R1 | 1 | 1 | 1 | 1 | 1 | 0 | 1 | all |
| R2 | 1 | 1 | 0 | 0 | 0 | 2 | 1 | F1 |
| R3 | 0 | 0 | 1 | 1 | 1 | 0 | 1 | F2 |
| R4 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | F3 |
| R5 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | F4 |
| R6 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | F5 |
| R7 | 1 | 1 | 0 | 0 | 0 | 1 | 1 | all-F2 |

## 结论

- **R2（仅 F1）**：O0/O1 出现（入口 + 极速）→ F1 负责入口与极速。
- **R3（仅 F2）**：O2/O3/O4 出现（加速/急刹/压弯）→ F2 负责事件统计。
- **R4/R5/R6（仅 F3/F4/F5）**：所有 O0..O4 均为 0 → 三者对 UI **无效**。
- **R7（all − F2）**：O2/O3/O4 消失，仅 O0/O1 在 → 再次确认 F2 是事件显示的唯一来源。

⇒ 生产脚本只保留 F1 + F2；`vehicleType` 等保持服务端原值（AE5i Pro），App 不再误认车型。
消融实验载体见 `experiments/ZeehoVehicleType.ablation.js`（`MODE` 常量切换各轮）。
