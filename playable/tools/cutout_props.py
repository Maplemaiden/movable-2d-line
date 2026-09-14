"""抠道具白/米色实心底：边角连通背景 + 可选 rembg 软边。"""
from pathlib import Path
import io
import numpy as np
from PIL import Image
import cv2

ROOT = Path(r"c:\Users\yoimi\Desktop\1\playable\assets\prop")
BAK = ROOT / "_bak_opaque"
OUT = ROOT
SKIP = {
    "blood_stain.png",
    "blood_stain_icon.png",
    "mop_blood.png",
    "mop_blood_icon.png",
    "mop_used.png",
    "mop_used_icon.png",
}
BG_DILATE = 3
TRY_REMBG = True


def already_cut(arr: np.ndarray) -> bool:
    if arr.ndim != 3 or arr.shape[2] < 4:
        return False
    a = arr[:, :, 3]
    # 四角透明且不整张不透明
    corners = [a[2, 2], a[2, -3], a[-3, 2], a[-3, -3]]
    return all(c < 8 for c in corners) and (a > 200).mean() < 0.98


def border_bg_mask(rgb: np.ndarray) -> np.ndarray:
    """与边角连通的近似均匀背景。"""
    h, w = rgb.shape[:2]
    # 取四角中位色作为底色参考
    samples = np.array(
        [
            rgb[2, 2],
            rgb[2, w - 3],
            rgb[h - 3, 2],
            rgb[h - 3, w - 3],
            rgb[2, w // 2],
            rgb[h // 2, 2],
        ],
        dtype=np.float32,
    )
    ref = np.median(samples, axis=0)
    diff = np.linalg.norm(rgb.astype(np.float32) - ref, axis=2)
    # 宽松：道具图底色很均匀
    near = diff <= 28
    # 也吃掉略偏亮/暗的同色相底
    lum = rgb.astype(np.float32).mean(axis=2)
    ref_lum = float(ref.mean())
    near |= (np.abs(lum - ref_lum) <= 18) & (diff <= 40)

    near_u8 = near.astype(np.uint8)
    num, labels = cv2.connectedComponents(near_u8, connectivity=8)
    border = set()
    border.update(labels[0, :].tolist())
    border.update(labels[-1, :].tolist())
    border.update(labels[:, 0].tolist())
    border.update(labels[:, -1].tolist())
    border.discard(0)
    bg = np.isin(labels, list(border))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (BG_DILATE * 2 + 1, BG_DILATE * 2 + 1))
    bg = cv2.dilate(bg.astype(np.uint8), k, iterations=1).astype(bool)
    return bg, ref


def decontaminate(rgb: np.ndarray, alpha: np.ndarray, ref: np.ndarray) -> np.ndarray:
    a = np.clip(alpha.astype(np.float32) / 255.0, 0, 1)
    c = rgb.astype(np.float32)
    with np.errstate(divide="ignore", invalid="ignore"):
        f = (c - ref.reshape(1, 1, 3) * (1.0 - a[..., None])) / np.maximum(a[..., None], 1e-4)
    f = np.clip(f, 0, 255)
    f[a < 0.01] = 0
    return f


def process_arr(rgb: np.ndarray, rembg_alpha: np.ndarray | None = None) -> np.ndarray:
    bg, ref = border_bg_mask(rgb)
    diff = np.linalg.norm(rgb.astype(np.float32) - ref.reshape(1, 1, 3), axis=2)
    # 与底色差大的像素视为前景（保住拖把金属杆等细长件）
    strong = diff > 35

    if rembg_alpha is not None:
        alpha = rembg_alpha.astype(np.float32).copy()
        # 只清掉「弱对比 + 边角连通」的底，避免吃掉细杆
        alpha[bg & (~strong)] = 0
        alpha = np.maximum(alpha, np.where(strong, 255.0, 0.0))
    else:
        alpha = np.where(bg & (~strong), 0.0, 255.0)

    hard = (alpha > 80).astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    # 闭运算接上细杆断口，再轻微收边
    hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, k, iterations=2)
    hard = cv2.erode(hard, k, iterations=1)
    soft = cv2.GaussianBlur(hard, (3, 3), 0).astype(np.float32)

    fg = decontaminate(rgb, soft, ref)
    dist = np.linalg.norm(fg - ref.reshape(1, 1, 3), axis=2)
    kill = (soft > 0) & (soft < 220) & (dist < 18) & (~strong)
    alpha = np.where(kill, 0.0, soft)
    alpha[alpha < 10] = 0
    out = np.dstack([fg, alpha])
    out[alpha < 1, 0:3] = 0
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    session = None
    if TRY_REMBG:
        try:
            from rembg import remove, new_session

            session = new_session("u2netp")
            remove_fn = remove
        except Exception as e:
            print("rembg unavailable, flood-fill only:", e)
            session = None
            remove_fn = None

    files = sorted(BAK.glob("*.png"))
    if not files:
        raise SystemExit(f"no backups in {BAK}")

    for p in files:
        if p.name in SKIP:
            # 保留已抠好的游戏内文件不动
            print(f"{p.name}\tSKIP")
            continue

        raw = np.array(Image.open(p).convert("RGBA"))
        if already_cut(raw) and p.name in SKIP:
            print(f"{p.name}\talready")
            continue

        rgb = raw[:, :, :3]
        rem_a = None
        if session is not None:
            cut = remove_fn(p.read_bytes(), session=session)
            rem_a = np.array(Image.open(io.BytesIO(cut)).convert("RGBA"))[:, :, 3]

        out = process_arr(rgb, rem_a)
        Image.fromarray(out, "RGBA").save(OUT / p.name, optimize=True)
        a = out[:, :, 3]
        print(
            f"{p.name}\tcornerA={int(a[2,2])}\topaque%={(a>200).mean():.3f}\tsize={out.shape[1]}x{out.shape[0]}"
        )
    print("done")


if __name__ == "__main__":
    main()
