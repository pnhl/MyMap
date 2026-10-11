"""Credential-shaped strings in release bytes; findings never contain values.

Provider UUID/hex formats overlap legitimate IDs/hashes, so those require a
credential label or provider URL. Distinctive Mapillary/JWT formats and opaque
high-entropy 32-character service keys also fail without nearby labels.
"""
import io, math, re, zipfile
from collections import Counter
from urllib.parse import unquote

PATTERNS = {
    'obsolete-public-provider-variable': re.compile(r'EXPO_PUBLIC_(?:STADIA_MAPS_API_KEY|TOMTOM_TRAFFIC_KEY|MAPILLARY_ACCESS_TOKEN|GRAPHHOPPER_KEY|CESIUM_ION_TOKEN)'),
    'mapillary-access-token': re.compile(r'\bMLY\|[A-Za-z0-9_-]{8,}\|[A-Za-z0-9_|-]{12,}'),
    'embedded-jwt': re.compile(r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'),
    'provider-url-credential': re.compile(r'https?://[^\s\x00"<>]{0,100}(?:stadiamaps\.com|tomtom\.com|graphhopper\.com|mapillary\.com|cesium\.com)[^\s\x00"<>]{0,2048}?[?&](?:api_key|apikey|key|access_token|token)=[A-Za-z0-9_%|.-]{8,}', re.I),
    'labelled-provider-credential': re.compile(r'(?:STADIA(?:_MAPS)?(?:_API)?_KEY|TOMTOM(?:_TRAFFIC)?_KEY|GRAPHHOPPER_KEY|MAPILLARY(?:_ACCESS)?_TOKEN|CESIUM_ION_TOKEN|stadiaMapsKey|tomTomTrafficKey|graphHopperKey|mapillaryToken|cesiumIonToken)[\s\x00"\x27:=,]{1,24}[A-Za-z0-9_|.-]{16,}', re.I),
}
OPAQUE_KEY = re.compile(r'(?<![A-Za-z0-9_])[A-Za-z0-9]{32}(?![A-Za-z0-9_])')
CHUNK = 2 * 1024 * 1024
OVERLAP = 8192

def credential_categories(data):
    # Both Android resources and Windows/iOS tools can embed UTF-16 strings.
    texts = [data.decode('utf8', errors='ignore')]
    for offset in (0, 1):
        texts.append(data[offset:].decode('utf-16-le', errors='ignore'))
        texts.append(data[offset:].decode('utf-16-be', errors='ignore'))
    found = set()
    for original in texts:
        for text in (original, unquote(original)) if '%' in original else (original,):
            for category, pattern in PATTERNS.items():
                if pattern.search(text): found.add(category)
            for match in OPAQUE_KEY.finditer(text):
                value = match.group()
                counts = Counter(value)
                entropy = -sum((n/32)*math.log2(n/32) for n in counts.values())
                if (sum(c.isupper() for c in value)>=4 and sum(c.islower() for c in value)>=4
                    and sum(c.isdigit() for c in value)>=4 and len(counts)>=20 and entropy>=4.4):
                    found.add('opaque-provider-key')
    return sorted(found)

def scan_stream(stream):
    found=set(); tail=b''
    while True:
        chunk=stream.read(CHUNK)
        if not chunk: break
        data=tail+chunk
        found.update(credential_categories(data))
        tail=data[-OVERLAP:]
    return sorted(found)

def archive_provider_secrets(archive, depth=0):
    scanned=0
    for member in archive.infolist():
        if member.is_dir(): continue
        with archive.open(member) as stream: categories=scan_stream(stream)
        scanned+=1
        if categories:
            # Archive names can themselves contain a credential; do not echo them.
            raise ValueError('Provider credential detected in release member ('+', '.join(categories)+'); values and member names suppressed')
        if depth<2 and member.filename.lower().endswith(('.zip','.jar','.apk','.aab','.ipa')):
            if member.file_size>128*1024*1024: raise ValueError('Nested archive exceeds credential-scan limit')
            with zipfile.ZipFile(io.BytesIO(archive.read(member))) as nested:
                scanned+=archive_provider_secrets(nested,depth+1)['scannedFiles']
    return {'scannedFiles':scanned,'providerCredentials':0}

def scan_path(path):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive: return archive_provider_secrets(archive)
    with path.open('rb') as stream: categories=scan_stream(stream)
    if categories: raise ValueError('Provider credential detected in release bytes ('+', '.join(categories)+'); values suppressed')
    return {'scannedFiles':1,'providerCredentials':0}
