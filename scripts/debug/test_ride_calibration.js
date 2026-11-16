#!/usr/bin/env node
/**
 * ZeehoRideFill 算法桩测 —— 验证 iOS 与 Xposed 在真值样本上输出一致。
 *
 * 样本：AE7 Pro 2026-11-16 18:02:46，47.2 km / 732 点 / 121.7 min
 * 服务端原值：accelerationTimes=3, brakesTimes=5, bendingTimes=13
 *
 * 用法：node SpeedHunter-iOS/scripts/debug/test_ride_calibration.js [轨迹JSON]
 * 默认轨迹文件：/tmp/ae7_long.json（由 tools/ride/eval_traj.py 生成）
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const trajFile = process.argv[2] || '/tmp/ae7_long.json';
const data = JSON.parse(fs.readFileSync(trajFile, 'utf8'));
const pts = data.points.map(p => ({ lon: p[0], lat: p[1], v: p[2], t: p[3], d: 0 }));

// 捕获脚本里的函数：在 vm 沙箱里跑，注入 Shadowrocket 全局桩
let captured = null;
const logs = [];
const sandbox = {
  console: { log: (...a) => logs.push(a.join(' ')) },
  $persistentStore: { read: () => null, write: () => {} },
  $request: { url: 'https://tapi.zeehoev.com/ridetrack_v2' },
  $response: { body: JSON.stringify({ code: '10000', data: [] }) },
  $done: () => {},
  JSON, Math, isNaN, parseFloat, parseInt, String, Array, Object, Infinity,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const scriptPath = path.join(__dirname, '..', 'ZeehoRideFill.js');
const src = fs.readFileSync(scriptPath, 'utf8') +
  '\n;globalThis.__FNS = { countBrakes: countBrakes, countBends: countBends, C: C };';
vm.runInContext(src, sandbox, { filename: 'ZeehoRideFill.js' });
const F = sandbox.__FNS;

// 短行程门槛（与脚本主流程一致）
function distM(lon1, lat1, lon2, lat2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
let meters = 0;
for (let i = 1; i < pts.length; i++) meters += distM(pts[i - 1].lon, pts[i - 1].lat, pts[i].lon, pts[i].lat);

let brakes = F.countBrakes(pts);
let bends = F.countBends(pts);
if (meters / 1000 < F.C.BEND_MIN_KM) bends = 0;

const ref = data.ref;
console.log('=== iOS ZeehoRideFill 算法桩测 ===');
console.log('样本: ' + (data.meta ? data.meta.start : trajFile) +
  '  pts=' + pts.length + '  km=' + (meters / 1000).toFixed(1));
console.log('参数: A_MIN=' + F.C.A_MIN + ' BEND_CUM_MIN=' + F.C.BEND_CUM_MIN +
  ' CALIB_FACTOR=' + F.C.CALIB_FACTOR + ' BEND_MIN_KM=' + F.C.BEND_MIN_KM);
console.log('真值: accel=' + ref.acc + ' brake=' + ref.brake + ' bend=' + ref.bend);
console.log('算法: accel=不回填(服务端真值) brake=' + brakes + ' bend=' + bends);
const okBrake = brakes === ref.brake, okBend = bends === ref.bend;
console.log('结果: ' + (okBrake && okBend ? 'PASS' : 'FAIL') +
  (okBrake ? '' : ' [brake 不符]') + (okBend ? '' : ' [bend 不符]'));
process.exit(okBrake && okBend ? 0 : 1);
