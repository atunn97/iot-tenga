// Bộ phát hiện té ngã — luật 3 bước (ngưỡng đặt tay, bản 0 — số lấy theo tài liệu, CHƯA dò trên SisFall)
//   ① va chạm:   |a| ≥ 2,5 g
//   ② nằm yên:   bỏ qua 1 s dội sau va chạm, rồi trong 1,5 s kế tiếp |a| quanh 1 g và gần như không dao động
//   ③ tư thế đổi: hướng trọng lực lúc nằm yên lệch ≥ 60° so với 1 s trước va chạm (tắt được)
// Lắc tay / nhảy qua được ① nhưng trượt ② ⇒ bị loại. Té thật qua cả ba.

const LUAT = {
  vaCham: 2.5,          // g
  choDoi: 1000,         // ms bỏ qua sau va chạm (người/điện thoại còn dội)
  cuaSoYen: 1500,       // ms xét nằm yên
  doLechYen: 0.10,      // g — độ lệch chuẩn |a| tối đa trong cửa sổ nằm yên
  lechTrungBinh: 0.20,  // g — |trung bình |a| − 1| tối đa (nằm yên thì chỉ còn trọng lực)
  gocTuThe: 60,         // độ
  nghi: 5000,           // ms không xét tiếp sau khi đã báo té
};

class BoPhatHien {
  // khiCoSuKien({loai: 'va-cham' | 'te' | 'bo-qua', t, ...})
  constructor(khiCoSuKien) {
    this.su = khiCoSuKien;
    this.kiemTuThe = true;
    this.huong = null;       // hướng trọng lực đã làm mượt (lọc thông thấp)
    this.lichSuHuong = [];   // {t, h} trong 2,5 s gần nhất — để lấy hướng TRƯỚC va chạm
    this.datLai();
  }

  datLai() { this.trangThai = 'canh'; this.tVa = 0; this.dinh = 0; this.cuaSo = []; }

  // t: ms · x, y, z: gia tốc theo g (có cả trọng lực)
  them(t, x, y, z) {
    const a = Math.hypot(x, y, z);
    const k = 0.05;  // ở 60 Hz ≈ hằng số thời gian 0,3 s
    this.huong = this.huong ? this.huong.map((v, i) => v + k * ([x, y, z][i] - v)) : [x, y, z];
    this.lichSuHuong.push({ t, h: this.huong });
    while (t - this.lichSuHuong[0].t > 2500) this.lichSuHuong.shift();

    if (this.trangThai === 'nghi') {
      if (t - this.tVa > LUAT.nghi) this.datLai();
      return;
    }

    if (a >= LUAT.vaCham) {                          // ① va chạm (va chạm mới trong lúc chờ thì tính lại từ đầu)
      if (this.trangThai === 'canh') {
        const truoc = this.lichSuHuong.find(p => p.t >= t - 1000) || this.lichSuHuong[0];
        this.huongTruoc = truoc.h;
        this.dinh = 0;
        this.su({ loai: 'va-cham', t, dinh: a });
      }
      this.trangThai = 'sau-va-cham';
      this.tVa = t;
      this.dinh = Math.max(this.dinh, a);
      this.cuaSo = [];
      return;
    }

    if (this.trangThai === 'sau-va-cham') {
      const qua = t - this.tVa;
      if (qua < LUAT.choDoi) return;
      this.cuaSo.push([x, y, z, a]);
      if (qua >= LUAT.choDoi + LUAT.cuaSoYen) this.ketLuan(t);
    }
  }

  ketLuan(t) {                                       // ② nằm yên? ③ tư thế đổi?
    const n = this.cuaSo.length;
    const tb = this.cuaSo.reduce((s, p) => s + p[3], 0) / n;
    const doLech = Math.sqrt(this.cuaSo.reduce((s, p) => s + (p[3] - tb) ** 2, 0) / n);
    const v = [0, 1, 2].map(i => this.cuaSo.reduce((s, p) => s + p[i], 0) / n);
    const h = this.huongTruoc;
    const cos = (v[0] * h[0] + v[1] * h[1] + v[2] * h[2]) / (Math.hypot(...v) * Math.hypot(...h) || 1);
    const goc = Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;

    const yen = doLech < LUAT.doLechYen && Math.abs(tb - 1) < LUAT.lechTrungBinh;
    const doiTuThe = goc >= LUAT.gocTuThe;
    const te = yen && (!this.kiemTuThe || doiTuThe);
    const lyDo = te ? 'va chạm → nằm yên' + (this.kiemTuThe ? ' → tư thế đổi' : '')
               : !yen ? 'không nằm yên sau va chạm (lắc, nhảy, chạy…)'
               : 'nằm yên nhưng tư thế không đổi (vd đặt điện thoại xuống)';

    this.su({ loai: te ? 'te' : 'bo-qua', t, tVa: this.tVa, dinh: this.dinh, doLech, trungBinh: tb, goc, yen, doiTuThe, lyDo });
    if (te) { this.trangThai = 'nghi'; this.tVa = t; } else this.datLai();
  }
}

// Một dòng mô tả sự kiện, dùng chung cho điện thoại và trang giám sát
function moTaSuKien(s) {
  const so = x => x.toFixed(2).replace('.', ',');
  if (s.loai === 'va-cham') return 'va chạm ' + so(s.dinh) + ' g — đang xem có nằm yên không…';
  return (s.loai === 'te' ? 'TÉ NGÃ' : 'bỏ qua') + ': ' + s.lyDo +
    ' · đỉnh ' + so(s.dinh) + ' g · dao động ' + so(s.doLech) + ' g · tư thế đổi ' + Math.round(s.goc) + '°';
}
