"""从白底原图抠立绘：边角洪水填白 + rembg 软边 + 强收缩去光晕。"""
from pathlib import Path
import io
import numpy as np
from PIL import Image
from rembg import remove, new_session
import cv2

BAK = Path(r"c:\Users\yoimi\Desktop\1\playable\assets\portrait\_bak_opaque")
OUT = Path(r"c:\Users\yoimi\Desktop\1\playable\assets\portrait")
MODEL = "u2netp"
BG_DILATE = 5  # 白底蒙版外扩，吃掉抗锯齿白边
ALPHA_ERODE = 2


def border_white_mask(rgb: np.ndarray) -> np.ndarray:
    """与画布边相连的近白区域 = 背景（含手臂空隙）。"""
    # 宽松近白：覆盖抗锯齿浅灰边
    lum = rgb.astype(np.float32).mean(axis=2)
    chroma = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16)
    near = (lum >= 235) & (chroma <= 18)
    near |= (lum >= 245)

    near_u8 = near.astype(np.uint8)
    num, labels = cv2.connectedComponents(near_u8, connectivity=8)
    h, w = near.shape
    border_labels = set()
    border_labels.update(labels[0, :].tolist())
    border_labels.update(labels[-1, :].tolist())
    border_labels.update(labels[:, 0].tolist())
    border_labels.update(labels[:, -1].tolist())
    border_labels.discard(0)

    bg = np.isin(labels, list(border_labels))
    # 外扩吃白边
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (BG_DILATE * 2 + 1, BG_DILATE * 2 + 1))
    bg = cv2.dilate(bg.astype(np.uint8), k, iterations=1).astype(bool)
    return bg


def white_decontaminate(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    a = np.clip(alpha.astype(np.float32) / 255.0, 0, 1)
    c = rgb.astype(np.float32)
    with np.errstate(divide="ignore", invalid="ignore"):
        f = (c - 255.0 * (1.0 - a[..., None])) / np.maximum(a[..., None], 1e-4)
    f = np.clip(f, 0, 255)
    f[a < 0.01] = 0
    return f


def process_one(src_bytes: bytes, session) -> np.ndarray:
    src_rgb = np.array(Image.open(io.BytesIO(src_bytes)).convert("RGB"))
    bg = border_white_mask(src_rgb)

    cut = remove(src_bytes, session=session)
    rem_a = np.array(Image.open(io.BytesIO(cut)).convert("RGBA"))[:, :, 3].astype(np.float32)

    # 背景强制透明；前景用 rembg，再腐蚀收边
    alpha = rem_a.copy()
    alpha[bg] = 0

    hard = (alpha > 90).astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ALPHA_ERODE * 2 + 1, ALPHA_ERODE * 2 + 1))
    hard = cv2.erode(hard, k, iterations=1)
    soft = cv2.GaussianBlur(hard, (3, 3), 0).astype(np.float32)
    alpha = np.minimum(alpha, soft)

    # 仍偏白且不够实心的边缘直接扔掉（白光晕杀手）
    fg_est = white_decontaminate(src_rgb, alpha)
    lum = fg_est.mean(axis=2)
    kill = (alpha > 0) & (alpha < 230) & (lum > 215) & (fg_est.min(axis=2) > 200)
    alpha = np.where(kill, 0.0, alpha)

    # 再根据与背景距离，外侧 2px 内若仍很亮则降 alpha
    solid = (alpha > 20).astype(np.uint8)
    din = cv2.distanceTransform(solid, cv2.DIST_L2, 3)
    rim = (din > 0) & (din <= 2.5) & (alpha > 0)
    alpha = np.where(rim & (lum > 190), alpha * 0.15, alpha)
    fg_est = np.where((rim & (lum > 190))[..., None], fg_est * 0.5, fg_est)

    # 最终：透明处 RGB 清零；实心区用反合成色
    out_rgb = white_decontaminate(src_rgb, alpha)
    # 对 rim 再混合一次内侧色，避免残留高亮
    deep = (din > 3) & (alpha > 180)
    for c in range(3):
        blur = cv2.blur(out_rgb[:, :, c], (7, 7))
        ref = np.where(deep, out_rgb[:, :, c], blur)
        out_rgb[:, :, c] = np.where(rim, ref, out_rgb[:, :, c])

    alpha[alpha < 12] = 0
    out = np.dstack([out_rgb, alpha])
    out[alpha < 1, 0:3] = 0
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    session = new_session(MODEL)
    files = sorted(BAK.glob("*.png"))
    if not files:
        raise SystemExit(f"no backups in {BAK}")

    for p in files:
        arr = process_one(p.read_bytes(), session)
        Image.fromarray(arr, "RGBA").save(OUT / p.name, optimize=True)
        a = arr[:, :, 3]
        # 真正的外轮廓白边：有透明邻居、半透明、且亮
        has_t = cv2.dilate((a < 8).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        fringe = int(((a > 20) & (a < 240) & has_t & (arr[:, :, :3].mean(2) > 200)).sum())
        print(f"{p.name}\tcornerA={a[2,2]}\topaque={(a>200).mean():.3f}\trimWhite={fringe}")
    print("done")


if __name__ == "__main__":
    main()
