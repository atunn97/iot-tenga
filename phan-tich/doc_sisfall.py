"""Đọc bộ SisFall và kiểm đơn vị.

Chạy:  uv run --with numpy python phan-tich/doc_sisfall.py

Mỗi file: 9 cột số thô, 200 Hz, dòng kết thúc bằng ';'
  cột 1-3: ADXL345  (±16 g, 13 bit)  -> g = thô * 32 / 2^13
  cột 4-6: ITG3200  (con quay, bỏ qua)
  cột 7-9: MMA8451Q (±8 g, 14 bit)   -> g = thô * 16 / 2^14
Tên file: <mã hoạt động>_<người>_<lượt>.txt — Dxx = sinh hoạt, Fxx = té; SAxx = 19–30 tuổi, SExx = 60–75 tuổi.
"""
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np

GOC = Path(__file__).resolve().parent.parent / 'data' / 'SisFall_dataset'
HZ = 200
HE_SO_ADXL = 32 / 2**13          # g trên một đơn vị thô
TEN = re.compile(r'([DF]\d\d)_(S[AE]\d\d)_R(\d\d)\.txt$')


def doc(duong_dan):
    """Trả về mảng (n, 3) gia tốc ADXL345 theo g."""
    # vài file có dòng trống / dòng cụt ở cuối ⇒ tự tách thay vì np.loadtxt
    dong = [d.split(',')[:3] for d in Path(duong_dan).read_text().split(';')]
    so = np.array([[int(x) for x in d] for d in dong if len(d) == 3 and all(x.strip() for x in d)], dtype=float)
    return so * HE_SO_ADXL


def danh_sach():
    for p in sorted(GOC.glob('S[AE]*/*.txt')):
        m = TEN.search(p.name)
        if m:
            yield p, m.group(1), m.group(2), int(m.group(3))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    tep = list(danh_sach())
    nguoi = sorted({n for _, _, n, _ in tep})
    loai = Counter('té' if ma[0] == 'F' else 'sinh hoạt' for _, ma, _, _ in tep)
    print(f'{len(tep)} file · {len(nguoi)} người '
          f'({sum(n.startswith("SA") for n in nguoi)} trẻ, {sum(n.startswith("SE") for n in nguoi)} cao tuổi) · {dict(loai)}')

    # Kiểm đơn vị: 1 giây đầu của mọi file té (người còn đứng/ngồi yên trước khi té) phải ≈ 1 g
    dau, dinh_te, dinh_sh = [], [], []
    for p, ma, _, _ in tep:
        a = np.linalg.norm(doc(p), axis=1)
        if ma[0] == 'F':
            dau.append(a[:HZ].mean())
            dinh_te.append(a.max())
        else:
            dinh_sh.append(a.max())
    dau = np.array(dau)
    print(f'|a| trung bình 1 s đầu của file té: {np.median(dau):.3f} g (trung vị) · '
          f'khoảng 5–95 %: {np.percentile(dau, 5):.3f}–{np.percentile(dau, 95):.3f} g  ⇒ đơn vị đúng nếu ≈ 1')
    for ten, d in (('té', dinh_te), ('sinh hoạt', dinh_sh)):
        d = np.array(d)
        print(f'đỉnh |a| mỗi file {ten:>9}: trung vị {np.median(d):.2f} g · '
              f'5 % thấp nhất < {np.percentile(d, 5):.2f} g · 5 % cao nhất > {np.percentile(d, 95):.2f} g')
