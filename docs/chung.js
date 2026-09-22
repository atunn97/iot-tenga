// Phần dùng chung cho trang điện thoại (index.html) và trang giám sát (giam-sat.html)

const G = 9.80665;
const CUA_SO_GIAY = 10;          // biểu đồ hiển thị 10 s gần nhất
const NGUONG_TAM = 2.5;          // vạch ① va chạm trên biểu đồ — khớp LUAT.vaCham trong phat-hien.js

// Broker MQTT công cộng, nói chuyện qua WebSocket có mã hoá (wss) — trang HTTPS chỉ được dùng wss.
// ?broker=1 để đổi sang broker dự phòng nếu broker chính trục trặc lúc demo.
const BROKER = [
  { ten: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { ten: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
];
const thamSo = new URLSearchParams(location.search);
const MA_KENH = (thamSo.get('kenh') || 'k7q2x9').replace(/[^a-z0-9-]/gi, '');
const KENH = 'iot-tenga/' + MA_KENH;          // KENH/a = dữ liệu |a| · KENH/canh-bao = cảnh báo
const BROKER_DUNG = BROKER[Math.min(Math.max(+thamSo.get('broker') || 0, 0), BROKER.length - 1)];

// trangThai(loai, chu): loai = 'dang' | 'ok' | 'loi'
function ketNoiMqtt(trangThai, khiCoTin) {
  if (typeof mqtt === 'undefined') { trangThai('loi', 'không tải được thư viện MQTT (mất mạng?)'); return null; }
  const client = mqtt.connect(BROKER_DUNG.url, {
    clientId: 'tenga-' + Math.random().toString(16).slice(2, 10),
    clean: true, connectTimeout: 20000, reconnectPeriod: 2000,
  });
  trangThai('dang', 'đang nối ' + BROKER_DUNG.ten + '…');
  client.on('connect', () => {
    trangThai('ok', 'đã nối ' + BROKER_DUNG.ten + ' · kênh ' + MA_KENH);
    if (khiCoTin) client.subscribe(KENH + '/#', { qos: 0 });
  });
  client.on('reconnect', () => trangThai('dang', 'đang nối lại ' + BROKER_DUNG.ten + '…'));
  client.on('offline', () => trangThai('loi', 'mất kết nối ' + BROKER_DUNG.ten));
  client.on('error', e => trangThai('loi', 'lỗi MQTT: ' + e.message));
  if (khiCoTin) client.on('message', (chuDe, noiDung) => {
    try { khiCoTin(chuDe.slice(KENH.length + 1), JSON.parse(noiDung.toString())); } catch (_) {}
  });
  return client;
}

function mauCss(ten) { return getComputedStyle(document.documentElement).getPropertyValue(ten).trim(); }

// Vẽ |a| của 10 s gần nhất. mau = [{t: performance.now() ms, a: g}]. Trả về đỉnh trong cửa sổ.
// dau = [{t, loai}] — vạch dọc đánh dấu sự kiện của bộ phát hiện: va-cham (vàng) · te (đỏ) · bo-qua (xám)
function veBieuDo(canvas, mau, dau = []) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const trai = 34, duoi = 18, tren = 6, rong = w - trai - 6, cao = h - duoi - tren;
  const dinh = mau.reduce((m, p) => Math.max(m, p.a), 0);
  const yMax = Math.max(4, Math.ceil(dinh + 0.5));
  const Y = a => tren + cao * (1 - a / yMax);
  const bay = performance.now();
  const X = t => trai + rong * (1 - (bay - t) / (CUA_SO_GIAY * 1000));

  ctx.font = '11px -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = mauCss('--phu'); ctx.strokeStyle = mauCss('--luoi'); ctx.lineWidth = 1;
  for (let g = 0; g <= yMax; g++) {
    ctx.beginPath(); ctx.moveTo(trai, Y(g)); ctx.lineTo(trai + rong, Y(g)); ctx.stroke();
    ctx.fillText(g + ' g', 4, Y(g) + 4);
  }
  for (let s = 0; s <= CUA_SO_GIAY; s += 2) {
    const con = CUA_SO_GIAY - s;
    ctx.textAlign = con === 0 ? 'right' : 'center';
    ctx.fillText(con === 0 ? 'bây giờ' : '−' + con + 's', X(bay - con * 1000), h - 4);
  }
  ctx.textAlign = 'left';

  const duongNgang = (a, mau_) => {
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = mau_; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(trai, Y(a)); ctx.lineTo(trai + rong, Y(a)); ctx.stroke(); ctx.restore();
  };
  duongNgang(1, mauCss('--xanh'));
  duongNgang(NGUONG_TAM, mauCss('--do'));

  const mauDau = { 'va-cham': '--vang', te: '--do', 'bo-qua': '--phu' };
  for (const d of dau) {
    const x = X(d.t);
    if (x < trai || x > trai + rong) continue;
    ctx.save(); ctx.strokeStyle = mauCss(mauDau[d.loai] || '--phu'); ctx.lineWidth = d.loai === 'te' ? 3 : 1.5;
    if (d.loai !== 'te') ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, tren); ctx.lineTo(x, tren + cao); ctx.stroke(); ctx.restore();
  }

  if (mau.length > 1) {
    ctx.save();
    ctx.beginPath(); ctx.rect(trai, 0, rong, h); ctx.clip();
    ctx.strokeStyle = mauCss('--lam'); ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    mau.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.a)) : ctx.moveTo(X(p.t), Y(p.a)));
    ctx.stroke();
    ctx.restore();
  }
  return dinh;
}

// Bỏ mẫu cũ hơn cửa sổ hiển thị
function catMau(mau, bay) {
  while (mau.length && bay - mau[0].t > CUA_SO_GIAY * 1000) mau.shift();
}
