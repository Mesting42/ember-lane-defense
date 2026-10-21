"""Encode pre-rendered RGBA geometry as runtime sprites, icons and a contact sheet."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import shutil

root = Path(__file__).resolve().parents[1]
source = root / 'art-source/zsky/rendered-raw'
target = root / 'public/assets/towers'
generated = root / 'src/generated'
target.mkdir(parents=True, exist_ok=True)
generated.mkdir(parents=True, exist_ok=True)
metadata = json.loads((source / 'tower-atlas.json').read_text())
names = dict(needle='针蜂', rail='轨矛', arc='弧光', comet='彗星', cold='冷凝', drone='巡游蜂巢', relay='脉冲哨塔', shield='护盾冲击塔', lure='诱导震荡塔')
font_path = Path('C:/Windows/Fonts/msyh.ttc')
font = ImageFont.truetype(str(font_path), 18)
title_font = ImageFont.truetype(str(font_path), 26)
small_font = ImageFont.truetype(str(font_path), 11)
contact = Image.new('RGB', (900, 790), '#101b22')
draw = ImageDraw.Draw(contact)
draw.text((28, 20), '余烬防线 / 九类防御设施', font=title_font, fill='#d7e4df')
draw.text((28, 60), 'ZSKY MODELS  /  EMBER MATERIALS  /  32 DIRECTION SPRITES', font=small_font, fill='#8caeb7')

def raw(name):
    return Image.frombytes('RGBA', (384, 384), (source / name).read_bytes())

for i, (kind, label) in enumerate(names.items()):
    raw(f'{kind}-base.rgba').save(target / f'{kind}-base-hd.png', optimize=True)
    hd_atlas = Image.new('RGBA', (384 * 8, 384 * 4))
    for frame in range(32):
        hd_atlas.paste(raw(f'{kind}-{frame}.rgba'), ((frame % 8) * 384, (frame // 8) * 384))
    hd_atlas.save(target / f'{kind}-head-hd.webp', lossless=True, method=6)
    base = raw(f'{kind}-base.rgba').resize((192, 192), Image.Resampling.LANCZOS)
    base.save(target / f'{kind}-base.png', optimize=True)
    atlas = Image.new('RGBA', (192 * 8, 192 * 4))
    for frame in range(32):
        image = raw(f'{kind}-{frame}.rgba').resize((192, 192), Image.Resampling.LANCZOS)
        atlas.paste(image, ((frame % 8) * 192, (frame // 8) * 192))
    atlas.save(target / f'{kind}-head.webp', lossless=True, method=6)
    image = raw(f'{kind}-icon.rgba')
    cropped = image.crop(image.getbbox())
    cropped.thumbnail((172, 172), Image.Resampling.LANCZOS)
    icon = Image.new('RGBA', (192, 192))
    icon.paste(cropped, ((192-cropped.width)//2, (192-cropped.height)//2))
    icon.save(target / f'{kind}-icon.png', optimize=True)
    x, y = (i % 3) * 300, 95 + (i // 3) * 225
    draw.rounded_rectangle((x+14, y, x+286, y+211), radius=5, fill='#14232c', outline='#2c454e')
    contact.paste(icon, (x+54, y+2), icon)
    draw.text((x+150, y+187), label, font=font, fill='#d9c294', anchor='mm')
    print(f'{kind}: packed')

contact.save(target / 'lineup.png', optimize=True)
(generated / 'tower-atlas.json').write_text(json.dumps(metadata, separators=(',', ':')), encoding='utf-8')
shutil.copy2(root / 'art-source/zsky/License.txt', target / 'License.txt')
(target / 'ATTRIBUTION.txt').write_text('Low Poly Sci Fi Turrets by Zsky (@Zsky_01)\nhttps://zsky2000.itch.io/low-poly-sci-fi-turrets\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\nModified for Ember Horizon: metallic recoloring, custom relay antenna, scale normalization, split base and head, pre-rendered directional sprites and muzzle anchors.\nThe original author does not endorse this game.\n', encoding='utf-8')
print('Runtime assets:', sum(p.stat().st_size for p in target.iterdir()), 'bytes')
