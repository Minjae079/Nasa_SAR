"""Create clearly synthetic data to exercise inference/export/UI, never real predictions."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import torch
from deepflood import CLASSES, predict_scene, export_prediction

PROTOTYPES = np.array([[-1.4, -1.7], [0.5, 0.6], [-2.0, -0.7], [1.8, -1.2]], dtype=np.float32)


class SyntheticFixture(torch.nn.Module):
    """Analytic nearest-prototype fixture. Not U-Net, not learned flood detection."""
    def forward(self, x):
        prototype = torch.as_tensor(PROTOTYPES, device=x.device)[None, :, :, None, None]
        return -((x[:, None] - prototype) ** 2).sum(dim=2)


def watermark(file, title):
    image = Image.open(file).convert("RGBA")
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    draw.rectangle((0, 0, image.width, 51), fill=(7, 17, 25, 255))
    draw.text((8, 6), "SYNTHETIC TEST - NOT SATELLITE DATA", fill="white", font=font)
    draw.text((8, 28), title, fill="#d5fa79", font=font)
    image.save(file)


def generate_demo(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    h, w = 256, 384
    r, c = np.mgrid[:h, :w]
    distance = abs(c - (w * 0.45 + 25 * np.sin(r / 28)))
    labels = np.ones((h, w), dtype=np.uint8)
    labels[distance < 48] = 0
    labels[distance < 19] = 2
    labels[(c > 295) & (r > 90) & (r < 210)] = 3
    valid = np.ones((h, w), dtype=bool)
    valid[(r > 200) & (c > 290)] = False
    rng = np.random.default_rng(404)
    x = PROTOTYPES[labels].transpose(2, 0, 1).copy()
    x += rng.normal(0, 0.08, x.shape).astype(np.float32)
    np.savez_compressed(root / "prepared.npz", x=x, valid_mask=valid)
    np.save(root / "reference_labels.npy", np.where(valid, labels, 255).astype(np.uint8), allow_pickle=False)
    prediction = predict_scene(SyntheticFixture(), x, valid)
    # export_prediction refuses overwriting run directories; choose a new path per
    # generation and atomically replace only this demo's small manifest last.
    from uuid import uuid4
    run = "demo-" + uuid4().hex[:8]
    output = export_prediction(prediction, valid, root, run_id=run,
        title="Synthetic pipeline output", observed_at="2000-01-01T00:00:00Z",
        model_version="analytic-fixture-NOT-trained-UNet",
        description="Artificial two-channel numeric input and analytic fixture, not real SAR or flood inference. Date is a placeholder.")
    entry = json.loads((output / "manifest.entry.json").read_text(encoding="utf-8"))
    entry.update(published=False, synthetic=True)
    (output / "manifest.entry.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
    rgb = np.stack([np.clip((x[0]+2.5)/5, 0, 1), np.clip((x[1]+2.5)/5, 0, 1),
                    np.full((h, w), 0.35)], axis=-1)
    Image.fromarray((rgb * 255).astype(np.uint8)).save(output / "input.png")
    reference = np.zeros((h, w, 4), dtype=np.uint8)
    for item in CLASSES:
        reference[(labels == item["id"]) & valid] = [*bytes.fromhex(item["color"][1:]), 255]
    Image.fromarray(reference).save(output / "reference.png")
    for file, title in [("input.png", "Artificial 2-channel input preview"),
                        ("reference.png", "Synthetic reference classes"),
                        ("prediction.png", "Analytic fixture output - NOT trained U-Net")]:
        watermark(output / file, title)
    results = []
    for name, title in [("input", "1. Synthetic input"), ("reference", "2. Synthetic reference"),
                        ("prediction", "3. Synthetic pipeline output")]:
        row = {**entry, "id": "demo-" + name, "title": title, "is_demo": True,
               "image_file": f"{run}/{name}.png"}
        if name == "input":
            row.pop("classes", None)
        results.append(row)
    temporary = root / "manifest.tmp.json"
    temporary.write_text(json.dumps({"synthetic": True, "results": results}, indent=2), encoding="utf-8")
    temporary.replace(root / "manifest.json")
    (root / "README.txt").write_text(
        "SYNTHETIC DEMO ONLY. prepared.npz contains x(float32,2x256x384), valid_mask(bool).\n"
        "Channels use artificial class prototypes; they are NOT VV/VH or HH/HV measurements.\n"
        "Output is from an analytic nearest-prototype fixture, not trained SmallUNet4.\n"
        "No observation time, georeferencing, performance or flood claims are valid.\n"
        "Do not publish this manifest through the real Supabase workflow.\n", encoding="utf-8")
    return root, output


if __name__ == "__main__":
    torch.set_num_threads(2)
    root, output = generate_demo(Path(__file__).resolve().parents[1] / "demo-data")
    print("Synthetic NPZ:", root / "prepared.npz")
    print("Synthetic PNGs:", output)
    print("Run npm run dev, open Model results, then Load synthetic demo.")
