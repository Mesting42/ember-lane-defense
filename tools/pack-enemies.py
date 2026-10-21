from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, shutil

root=Path(__file__).resolve().parents[1]
source=root/'art-source/kenney/rendered-raw'
target=root/'public/assets/enemies'
target.mkdir(parents=True,exist_ok=True)
meta=json.loads((source/'enemy-atlas.json').read_text(encoding='utf-8'))
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',26)
sheet=Image.new('RGB',(1000,600),'#101b22');draw=ImageDraw.Draw(sheet)
draw.text((26,18),'敌方舰群 / 八类入侵单位',font=title,fill='#dfc6a2')
for i,(kind,entry) in enumerate(meta['enemies'].items()):
    hd_atlas=Image.new('RGBA',(384*8,384*4))
    atlas=Image.new('RGBA',(192*8,192*4))
    for frame in range(32):
        original=Image.frombytes('RGBA',(384,384),(source/f'{kind}-{frame}.rgba').read_bytes())
        hd_atlas.paste(original,(frame%8*384,frame//8*384))
        image=original.resize((192,192),Image.Resampling.LANCZOS)
        atlas.paste(image,(frame%8*192,frame//8*192))
        if frame==28: icon=image
    atlas.save(target/f'{kind}.webp',lossless=True,method=6)
    hd_atlas.save(target/f'{kind}-hd.webp',lossless=True,method=6)
    cropped=icon.crop(icon.getbbox());cropped.thumbnail((172,158),Image.Resampling.LANCZOS)
    portrait=Image.new('RGBA',(192,192));portrait.paste(cropped,((192-cropped.width)//2,(192-cropped.height)//2))
    portrait.save(target/f'{kind}-icon.png',optimize=True)
    x=i%4*250;y=80+i//4*255
    draw.rounded_rectangle((x+12,y,x+238,y+236),5,fill='#17232c',outline='#4b3a3c')
    sheet.paste(portrait,(x+29,y+12),portrait)
    draw.text((x+125,y+212),entry['name'],font=font,fill='#d9bb9c',anchor='mm')
sheet.save(target/'lineup.png',optimize=True)
(root/'src/generated/enemy-atlas.json').write_text(json.dumps(meta,separators=(',',':')),encoding='utf-8')
shutil.copy2(root/'art-source/kenney/License.txt',target/'License.txt')
(target/'ATTRIBUTION.txt').write_text('Space Kit by Kenney\nhttps://kenney.nl/assets/space-kit\nCC0 1.0 Universal\nModified: recolored hulls, custom threat modules, directional sprite rendering.\n',encoding='utf-8')
print('Packed eight enemy sprites and icons.')
