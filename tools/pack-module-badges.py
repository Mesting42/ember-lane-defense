"""Encode generated transparent badge originals for the game's reward screen."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
source = root / 'art-source/module-badges'
target = root / 'public/assets/modules'
target.mkdir(parents=True, exist_ok=True)
manifest = json.loads((source / 'generation.json').read_text(encoding='utf-8'))
rows = []
preview = Image.new('RGB', (720, 728), '#101b22')
draw = ImageDraw.Draw(preview)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
names = {'module': '战术模块', 'relaySync': '火控协同', 'coil': '磁芯重铸', 'salvage': '战场回收', 'ember': '余烬弹链', 'coldAftershock': '凝霜回响', 'droneCare': '蜂巢协议', 'alloy': '钨铼弹芯', 'bossBreaker': '旗舰识别码'}
draw.text((30, 18), '余烬防线 / 立体金属战术徽章', font=font, fill='#d6e1db')
for badge in manifest['badges']:
    original = Image.open(source / 'originals' / f"{badge['id']}.png").convert('RGBA')
    assert original.width == original.height, badge['id']
    assert original.getchannel('A').getextrema()[0] == 0, badge['id']
    runtime = original.resize((384, 384), Image.Resampling.LANCZOS)
    file = target / f"{badge['id']}.webp"
    runtime.save(file, 'WEBP', quality=92, method=6, exact=True)
    index = len(rows)
    x, y = index % 3 * 240, index // 3 * 220 + 60
    thumbnail = runtime.resize((164, 164), Image.Resampling.LANCZOS)
    preview.paste(thumbnail, (x + 38, y), thumbnail)
    draw.text((x + 120, y + 182), names[badge['id']], font=font, fill='#d8c49e', anchor='mm')
    rows.append({'id': badge['id'], 'size': [384, 384], 'bytes': file.stat().st_size})
(source / 'runtime-assets.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
preview.save(source / 'preview.png', optimize=True)
print(f"Packed {len(rows)} transparent module badges: {sum(row['bytes'] for row in rows)} bytes")
