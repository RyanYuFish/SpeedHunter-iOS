/*
 * ZeehoRideDebug.js
 * 只打印 myRideInfo 和 ridetrack_v2 的响应
 */

const url = $request.url || "";
const raw = $response.body || "";

function log(s) {
  console.log("[ZeehoRide] " + s);
}

if (url.indexOf("/myRideInfo") !== -1) {
  log("URL=" + url);
  log("BODY=" + raw);
}

if (url.indexOf("/ridetrack_v2") !== -1) {
  log("URL=" + url);
  log("BODY=" + raw.slice(0, 20000)); // 防止太长
}

$done({});