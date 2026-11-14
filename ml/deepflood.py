"""Inference/export adapter for the supplied SmallUNet4 training cell.

Input is the SAME prepared, normalized two-channel array used during training.
This module deliberately does not guess sensor bands or normalize raw imagery.
"""
import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image
import torch
from torch import nn
from torch.nn import functional as F

CLASSES = [
    {"id": 0, "name": "Inundated vegetation", "color": "#20c7b5"},
    {"id": 1, "name": "Dry vegetation", "color": "#7eb44d"},
    {"id": 2, "name": "Open water", "color": "#377be8"},
    {"id": 3, "name": "Other", "color": "#c4a789"},
]


class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1), nn.GroupNorm(8, out_ch), nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1), nn.GroupNorm(8, out_ch), nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.net(x)


class SmallUNet4(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc1, self.enc2 = ConvBlock(2, 16), ConvBlock(16, 32)
        self.enc3, self.enc4 = ConvBlock(32, 64), ConvBlock(64, 128)
        self.pool = nn.MaxPool2d(2)
        self.center = ConvBlock(128, 256)
        self.dec4, self.dec3 = ConvBlock(384, 128), ConvBlock(192, 64)
        self.dec2, self.dec1 = ConvBlock(96, 32), ConvBlock(48, 16)
        self.head = nn.Conv2d(16, 4, 1)

    def up(self, x, skip, decoder):
        x = F.interpolate(x, size=skip.shape[-2:], mode="bilinear", align_corners=False)
        return decoder(torch.cat([x, skip], dim=1))

    def forward(self, x):
        s1 = self.enc1(x)
        s2 = self.enc2(self.pool(s1))
        s3 = self.enc3(self.pool(s2))
        s4 = self.enc4(self.pool(s3))
        x = self.center(self.pool(s4))
        return self.head(self.up(self.up(self.up(self.up(x, s4, self.dec4), s3, self.dec3), s2, self.dec2), s1, self.dec1))


def anchors(length, size=128, stride=64):
    if length <= 0 or stride <= 0 or stride > size:
        raise ValueError("Invalid scene dimensions or patch stride")
    if length <= size:
        return [0]
    stops = list(range(0, length - size + 1, stride))
    if stops[-1] != length - size:
        stops.append(length - size)
    return stops


@torch.inference_mode()
def predict_scene(model, x, valid_mask, device="cpu", batch_size=8):
    x = np.asarray(x)
    valid_mask = np.asarray(valid_mask)
    if x.ndim != 3 or x.shape[0] != 2 or min(x.shape[1:]) < 1:
        raise ValueError("x must have shape (2, height, width)")
    if valid_mask.shape != x.shape[1:] or valid_mask.dtype != np.bool_:
        raise ValueError("valid_mask must be a boolean (height, width) array from preprocessing")
    if not valid_mask.any() or not np.isfinite(x[:, valid_mask]).all():
        raise ValueError("Need finite, valid observations in both prepared channels")
    h, w = valid_mask.shape
    if h * w > 16000000 or not 1 <= batch_size <= 64:
        raise ValueError("Scene too large for this demo adapter; crop it before inference")
    # Invalid observations are neutral-filled only for computation and remain NoData.
    prepared = np.where(valid_mask[None], x, 0).astype(np.float32)
    prepared = np.pad(prepared, ((0, 0), (0, max(0, 128 - h)), (0, max(0, 128 - w))))
    ph, pw = prepared.shape[1:]
    scores = np.zeros((4, ph, pw), dtype=np.float32)
    counts = np.zeros((ph, pw), dtype=np.float32)
    coords = [(r, c) for r in anchors(ph) for c in anchors(pw)]
    model = model.to(device).eval()
    for start in range(0, len(coords), batch_size):
        positions = coords[start:start + batch_size]
        batch = torch.from_numpy(np.stack([prepared[:, r:r+128, c:c+128] for r, c in positions])).to(device)
        logits = model(batch)
        if tuple(logits.shape) != (len(positions), 4, 128, 128) or not torch.isfinite(logits).all():
            raise ValueError("Model must produce finite (batch, 4, 128, 128) logits")
        probs = logits.softmax(dim=1).cpu().numpy()
        for index, (r, c) in enumerate(positions):
            scores[:, r:r+128, c:c+128] += probs[index]
            counts[r:r+128, c:c+128] += 1
    if not (counts > 0).all():
        raise RuntimeError("Incomplete patch coverage")
    prediction = (scores / counts[None]).argmax(axis=0)[:h, :w].astype(np.uint8)
    prediction[~valid_mask] = 255
    return prediction


def export_prediction(prediction, valid_mask, output_dir, *, run_id, title, observed_at, model_version, description):
    """Also callable directly from the team's notebook after predict_scene()."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", run_id):
        raise ValueError("run_id must be unique ASCII letters/digits/underscore/hyphen")
    for value, maximum in [(title, 200), (model_version, 200), (description, 2000)]:
        if not isinstance(value, str) or not value.strip() or len(value) > maximum:
            raise ValueError("Need title, model version and description within manifest limits")
    if not isinstance(observed_at, str) or not observed_at.endswith("Z"):
        raise ValueError("observed_at must be the actual observation time in UTC, ending in Z")
    datetime.fromisoformat(observed_at[:-1] + "+00:00")
    prediction, valid_mask = np.asarray(prediction), np.asarray(valid_mask)
    if prediction.ndim != 2 or valid_mask.shape != prediction.shape or valid_mask.dtype != np.bool_:
        raise ValueError("Need matching 2D predictions and boolean valid mask")
    if not valid_mask.any() or not np.isin(prediction[valid_mask], [0, 1, 2, 3]).all():
        raise ValueError("Valid predictions must be class IDs 0..3")
    labels = np.where(valid_mask, prediction, 255).astype(np.uint8)
    rgba = np.zeros((*labels.shape, 4), dtype=np.uint8)
    for item in CLASSES:
        color = bytes.fromhex(item["color"][1:])
        rgba[labels == item["id"]] = [*color, 255]
    dest = Path(output_dir) / run_id
    dest.mkdir(parents=True, exist_ok=False)
    Image.fromarray(rgba).save(dest / "prediction.png")
    np.save(dest / "labels.npy", labels, allow_pickle=False)
    entry = dict(id=run_id, published=True, title=title, observed_at=observed_at,
                 model_version=model_version, description=description, validation_status="experimental",
                 image_path=f"results/{run_id}/prediction.png", classes=CLASSES)
    (dest / "manifest.entry.json").write_text(json.dumps(entry, indent=2, ensure_ascii=False), encoding="utf-8")
    return dest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--input", required=True, type=Path, help="Prepared NPZ containing x and valid_mask")
    parser.add_argument("--output-dir", type=Path, default=Path("ml-output"))
    for name in ["run-id", "title", "observed-at", "model-version", "description"]:
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    args = parser.parse_args()
    # Restrict checkpoint loading to modern weights-only loading. No pickle fallback.
    if tuple(int(x) for x in torch.__version__.split("+")[0].split(".")[:2]) < (2, 6):
        parser.error("Checkpoint loading requires PyTorch >= 2.6. Notebook export can be used separately.")
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    model = SmallUNet4()
    model.load_state_dict(checkpoint.get("model_state", checkpoint), strict=True)
    with np.load(args.input, allow_pickle=False) as prepared:
        x, valid = prepared["x"], prepared["valid_mask"]
    prediction = predict_scene(model, x, valid, device=args.device)
    dest = export_prediction(prediction, valid, args.output_dir, run_id=args.run_id,
        title=args.title, observed_at=args.observed_at, model_version=args.model_version, description=args.description)
    print("Created model outputs:", dest)


if __name__ == "__main__":
    main()
