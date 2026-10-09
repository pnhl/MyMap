"""Export generated MyMap key art to the exact requested opaque PNG sizes."""
from pathlib import Path
import argparse
from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('--icon', required=True)
parser.add_argument('--background', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
destination = root / 'dist' / 'appstore' / 'fire-tv' / 'en-US'
destination.mkdir(parents=True, exist_ok=True)
for source, filename, size in (
    (args.icon, 'MyMap-FireTV-app-icon-1280x720.png', (1280, 720)),
    (args.background, 'MyMap-FireTV-background-1920x1080.png', (1920, 1080)),
):
    image = Image.open(source).convert('RGB')
    image = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)
    image.save(destination / filename, optimize=True)
    print(f'{filename}: {image.size}, {image.mode}')
