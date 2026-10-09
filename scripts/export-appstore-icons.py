"""Export the existing MyMap logo at the Appstore's required icon sizes."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
output = root / 'dist' / 'appstore' / 'tablet' / 'en-US' / 'icons'
output.mkdir(parents=True, exist_ok=True)
source = Image.open(root / 'assets' / 'branding' / 'adaptive-foreground-v2.png').convert('RGBA')
art = source.crop(source.getchannel('A').getbbox())
for size in (512, 114):
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    scaled = art.copy()
    scaled.thumbnail((round(size * .84), round(size * .84)), Image.Resampling.LANCZOS)
    image.paste(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    path = output / f'MyMap-icon-{size}x{size}.png'
    image.save(path, optimize=True)
    assert image.size == (size, size) and image.getchannel('A').getextrema() == (0, 255)
    print(path)
