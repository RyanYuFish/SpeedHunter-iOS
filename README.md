# ZEEHO iOS Rocket

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue?logo=gnu&logoColor=white)](LICENSE)

**English** | [简体中文](docs/README.zh-CN.md)

A Shadowrocket module + scripts for the ZEEHO App on iOS. It restores ride-record
capabilities hidden by the server by rewriting a few HTTP responses through MITM — for
compatibility research and interface restoration on a personal device.
**Not affiliated with or authorized by ZEEHO / CFMOTO.**

## Features

| # | Script | Description |
| :-- | :----- | :---------- |
| 1 | **ZeehoVehicleType** | UI capability gate: sets `vehicleKinds = 2` + `cyclingEventStatisticFlag = true` on `vehicleHomePageV2` / `vehicle/list` → reveals the ride-analysis entry, top speed, and hard accel/brake/cornering. |
| 2 | **ZeehoRideFill** | Estimates hard-braking and cornering counts from `ridetrack_v2` GPS trajectories, then back-fills `myRideInfo` / `homeRideInfo` / `analyse` using a per-day store. |
| 3 | **ZeehoOTA** | OTA red-point replay — surfaces a same-version OTA upgrade notification. **Disabled by default; high risk, keep off.** See header comment. |
| 4 | **ZeehoClearStore / ZeehoCalibProbe / ZeehoProbe** | Disabled debug stubs (clear cache / calibration probe / full probe). Enable only for short debugging sessions. |

## Ablation study

8 rounds of ablation (R0–R7) proved that on iOS only two independent gates matter —
the minimal sufficient set is **F1 + F2**; `regulationType` (F3), `vehType` (F4) and the
`vehicleType` triple (F5) were confirmed redundant and removed. `vehicleType` is left at
its server value (AE5i Pro) so the App no longer misidentifies the model.
→ [docs/ablation.md](docs/ablation.md)

## Prerequisites

- Shadowrocket with **HTTPS decryption (MITM)** enabled, and a working CA certificate;
- Import the configuration and enable the scripts.

## Setup

```bash
# 1. Copy the template and fill in YOUR OWN MITM certificate
cp conf/Zeeho.conf.example conf/Zeeho.conf
#   → edit conf/Zeeho.conf [MITM] ca-p12 + ca-passphrase

# 2. In Shadowrocket: import conf/Zeeho.conf, enable HTTPS decryption,
#    and turn on the ZeehoVehicleType + ZeehoRideFill scripts.
```

`conf/Zeeho.conf` is git-ignored (it holds your personal cert). Only the sanitized
`conf/Zeeho.conf.example` is committed.

## Project layout

```
iOS-rocket/
├── conf/
│   ├── Zeeho.conf.example   # sanitized template (committed)
│   └── Zeeho.conf           # your personal config (git-ignored)
├── scripts/
│   ├── ZeehoVehicleType.js  # production: F1+F2 gate
│   ├── ZeehoRideFill.js     # production: trajectory estimate + fill
│   ├── ZeehoOTA.js          # disabled: OTA red-point replay
│   ├── ZeehoClearStore.js   # disabled stub
│   ├── ZeehoCalibProbe.js   # disabled stub
│   └── ZeehoProbe.js        # disabled stub
├── experiments/
│   ├── ZeehoVehicleType.legacy.js     # original single-script version
│   └── ZeehoVehicleType.ablation.js   # R0–R7 ablation harness (MODE switch)
├── docs/
│   ├── README.zh-CN.md
│   ├── ablation.md
│   └── changelog.md
├── LICENSE
└── .gitignore
```

## Safety and Privacy

- Does not upload ride records, vehicle info, location, or account data;
- Does not modify the ZEEHO App, bypass account permissions, or alter vehicle control logic;
- Speed/event data is for interface display only and cannot replace the dashboard or serve as a basis for safety decisions;
- **Do not operate the phone or rely on these readings while riding**;
- Logs may contain personal information such as VIN, ride records, and account fields — keep them secure and never commit them (see `.gitignore`);
- The OTA red-point replay (ZeehoOTA) can trigger a dashboard reflash. Flashing carries a brick risk; keep it disabled unless you fully understand the consequence.

## Unofficial Notice and License

This project has no affiliation, authorization, sponsorship, or cooperation relationship
with ZEEHO, CFMOTO, or their affiliates. Related names and icons belong to their
respective rights holders. It is intended only for compatibility research and interface
restoration on personal devices. No official support is provided and continued
compatibility is not guaranteed. Users must ensure they have lawful rights to use the
target device and comply with local laws and manufacturer warranty policies.

Original code and documentation are licensed under **AGPL-3.0**; this license does not
apply to ZEEHO / CFMOTO App data, trademarks, or content obtained through their interfaces.
