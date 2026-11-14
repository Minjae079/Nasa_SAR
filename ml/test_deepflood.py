"""Synthetic fixtures test the adapter only, not real-world model accuracy."""
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
from PIL import Image
import torch
from deepflood import SmallUNet4, anchors, predict_scene, export_prediction
from make_demo import generate_demo


class WaterFixture(torch.nn.Module):
    def forward(self, x):
        logits = torch.zeros((len(x), 4, *x.shape[-2:]), device=x.device)
        logits[:, 2] = 1
        return logits


class AdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_architecture_matches_four_class_training(self):
        model = SmallUNet4().eval()
        with torch.inference_mode():
            self.assertEqual(tuple(model(torch.zeros(1, 2, 128, 128)).shape), (1, 4, 128, 128))

    def test_demo_is_explicitly_synthetic_and_unpublished(self):
        with tempfile.TemporaryDirectory() as directory:
            root, output = generate_demo(directory)
            with np.load(root / 'prepared.npz', allow_pickle=False) as data:
                self.assertEqual(data['x'].shape, (2, 256, 384))
                self.assertEqual(data['valid_mask'].dtype, np.bool_)
            manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
            self.assertTrue(manifest['synthetic'])
            self.assertEqual(len(manifest['results']), 3)
            self.assertTrue(all(row['published'] is False for row in manifest['results']))
            for filename in ['input.png', 'reference.png', 'prediction.png']:
                with Image.open(output / filename) as image:
                    self.assertEqual(image.size, (384, 256))

    def test_tiling_nodata_and_small_scene(self):
        for shape in [(20, 25), (129, 250)]:
            valid = np.ones(shape, dtype=bool)
            valid[0, 0] = False
            pred = predict_scene(WaterFixture(), np.zeros((2, *shape), dtype=np.float32), valid)
            self.assertEqual(pred.shape, shape)
            self.assertEqual(pred[0, 0], 255)
            self.assertTrue((pred[valid] == 2).all())
        self.assertEqual(anchors(20), [0])

    def test_export_preserves_classes_and_transparency(self):
        labels = np.array([[0, 1], [2, 3]])
        valid = np.array([[True, True], [True, False]])
        with tempfile.TemporaryDirectory() as directory:
            dest = export_prediction(labels, valid, directory, run_id="test-only", title="Test fixture",
                observed_at="2026-11-13T00:00:00Z", model_version="test-only", description="Not a real prediction")
            image = np.array(Image.open(dest / "prediction.png"))
            self.assertEqual(int(image[1, 1, 3]), 0)
            self.assertEqual(int(image[1, 0, 3]), 255)
            self.assertEqual(int(np.load(dest / "labels.npy")[1, 1]), 255)
            entry = json.loads((dest / "manifest.entry.json").read_text(encoding="utf-8"))
            self.assertEqual(entry["image_path"], "results/test-only/prediction.png")
            self.assertEqual(len(entry["classes"]), 4)
            with self.assertRaises(FileExistsError):
                export_prediction(labels, valid, directory, run_id="test-only", title="Test",
                    observed_at="2026-11-13T00:00:00Z", model_version="test", description="Test")


if __name__ == "__main__":
    unittest.main()
