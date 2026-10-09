"""Reproducible brand art and geographic backdrops; never contains user activity."""
from pathlib import Path
import json, math, urllib.request, urllib.parse
from PIL import Image, ImageDraw, ImageFilter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
assets = root / 'assets' / 'design'
cache = root / '.expo' / 'design-source'
assets.mkdir(parents=True, exist_ok=True)
cache.mkdir(parents=True, exist_ok=True)

def fetch(url, name):
    path = cache / name
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'MyMap-design-assets/1.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            path.write_bytes(response.read())
    return path

fonts = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
sans = fetch(fonts + 'nunitosans/NunitoSans%5BYTLC,opsz,wdth,wght%5D.ttf', 'nunito.ttf')
for name, weight in [('Regular', 400), ('SemiBold', 600), ('Bold', 800)]:
    font = TTFont(sans)
    axes = {a.axisTag: a.defaultValue for a in font['fvar'].axes}
    axes.update(wght=weight, opsz=12)
    instantiateVariableFont(font, axes, inplace=True).save(assets / f'NunitoSans-{name}.ttf')
script = fetch(fonts + 'dancingscript/DancingScript%5Bwght%5D.ttf', 'dancing.ttf')
instantiateVariableFont(TTFont(script), {'wght': 500}, inplace=True).save(assets / 'DancingScript.ttf')
for family in ['nunitosans', 'dancingscript']:
    (assets / f'{family}-OFL.txt').write_bytes(fetch(fonts + family + '/OFL.txt', family + '-OFL.txt').read_bytes())

# An original M mark built from geometry, with a real transparent silhouette.
scale = 3
mask = Image.new('L', (240 * scale, 260 * scale))
d = ImageDraw.Draw(mask)
pts = [(35,195),(35,45),(118,120),(205,45),(205,195)]
d.line([(x*scale,y*scale) for x,y in pts], fill=255, width=41*scale, joint='curve')
for x,y in [(35,195),(35,45),(205,45),(205,195)]:
    d.ellipse(((x-20)*scale,(y-20)*scale,(x+20)*scale,(y+20)*scale),fill=255)
d.ellipse((94*scale,194*scale,142*scale,242*scale),fill=255)
d.polygon([(97*scale,224*scale),(118*scale,259*scale),(139*scale,224*scale)],fill=255)
d.ellipse((109*scale,209*scale,127*scale,227*scale),fill=0)
gradient = Image.new('RGBA', mask.size)
pixels = gradient.load()
for y in range(mask.height):
    t = y / mask.height
    for x in range(mask.width):
        light = max(0, 1-x/(100*scale)) * max(0, 1-y/(120*scale))
        pixels[x,y] = (int(50+70*t+100*light), int(214-100*t+35*light), 255, 255)
gradient.putalpha(mask)
gradient.resize((240,260), Image.Resampling.LANCZOS).save(assets / 'mymap-mark.png')

# World geometry is public-domain Natural Earth. Equirectangular projection.
world = json.loads(fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson', 'world.geojson').read_text('utf-8'))
image = Image.new('RGB', (1800,850), '#031333')
d = ImageDraw.Draw(image)
project = lambda lon,lat: ((lon+180)/360*1800,(85-lat)/170*850)
for lon in range(-180,181,30):
    x,_=project(lon,0); d.line([(x,0),(x,850)], fill='#0a3065',width=1)
for lat in range(-60,81,30):
    _,y=project(0,lat); d.line([(0,y),(1800,y)], fill='#0a3065',width=1)
for feature in world['features']:
    geom=feature['geometry']
    polygons=geom['coordinates'] if geom['type']=='MultiPolygon' else [geom['coordinates']]
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            points=[project(lon,lat) for lon,lat,*rest in ring]
            d.polygon(points,fill='#082858' if index==0 else '#031333')
            d.line(points,fill='#167ec4',width=2)
image.save(assets / 'world-map.png')

# Streets are actual OpenStreetMap ways. This image is decorative, without pins.
query='[out:json][timeout:25];way["highway"](10.750,106.650,10.825,106.735);out geom;'
try:
    try:
        source=fetch('https://overpass-api.de/api/interpreter?data='+urllib.parse.quote(query), 'hcmc-roads.json')
    except Exception:
        source=fetch('https://overpass.kumi.systems/api/interpreter?data='+urllib.parse.quote(query), 'hcmc-roads.json')
    ways=json.loads(source.read_text('utf-8'))['elements']
    roads=Image.new('RGB',(900,1600),'#041638'); d=ImageDraw.Draw(roads)
    project=lambda lon,lat: ((lon-106.650)/.085*900,(10.825-lat)/.075*1600)
    for way in ways:
        pts=[project(p['lon'],p['lat']) for p in way.get('geometry',[])]
        if len(pts)<2: continue
        highway=way.get('tags',{}).get('highway','')
        main=highway in ['primary','secondary','trunk','motorway']
        d.line(pts,fill='#185699' if main else '#0b3568',width=3 if main else 1)
    roads.save(assets / 'street-backdrop.png')
    print('Built geographic backdrop from',len(ways),'OSM ways.')
except Exception as error:
    # Do not invent streets if the geographic source is unavailable.
    image.rotate(-15,expand=True).resize((900,1600)).save(assets / 'street-backdrop.png')
    print('Street source unavailable; using real world geometry:',type(error).__name__)
print('Design assets ready.')
