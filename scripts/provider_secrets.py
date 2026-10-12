"""Credential-shaped strings in release bytes; findings never contain values.

Provider UUID/hex formats overlap legitimate IDs/hashes, so those require a
credential label or provider URL. Distinctive Mapillary/JWT formats and opaque
high-entropy 32-character service keys also fail without nearby labels.
"""
import hashlib, io, json, math, pathlib, re, struct, zipfile
from collections import Counter
from urllib.parse import unquote

PATTERNS = {
    'obsolete-public-provider-variable': re.compile(r'EXPO_PUBLIC_(?:STADIA_MAPS_API_KEY|TOMTOM_TRAFFIC_KEY|MAPILLARY_ACCESS_TOKEN|GRAPHHOPPER_KEY|CESIUM_ION_TOKEN)'),
    'mapillary-access-token': re.compile(r'\bMLY\|[A-Za-z0-9_-]{8,}\|[A-Za-z0-9_|-]{12,}'),
    'embedded-jwt': re.compile(r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'),
    'provider-url-credential': re.compile(r'https?://[^\s\x00"<>]{0,100}(?:stadiamaps\.com|tomtom\.com|graphhopper\.com|mapillary\.com|cesium\.com)[^\s\x00"<>]{0,2048}?[?&](?:api_key|apikey|key|access_token|token)=[A-Za-z0-9_%|.-]{8,}', re.I),
    'labelled-provider-credential': re.compile(r'(?:STADIA(?:_MAPS)?(?:_API)?_KEY|TOMTOM(?:_TRAFFIC)?_KEY|GRAPHHOPPER_KEY|MAPILLARY(?:_ACCESS)?_TOKEN|CESIUM_ION_TOKEN|stadiaMapsKey|tomTomTrafficKey|graphHopperKey|mapillaryToken|cesiumIonToken)[\s\x00"\x27:=,]{1,24}[A-Za-z0-9_|.-]{16,}', re.I),
}
# A complete opaque token, not a 32-character fragment of a public Base64
# certificate/digest (APK JAR manifests contain many such digest strings).
OPAQUE_KEY = re.compile(r'(?<![A-Za-z0-9_+/.\-])[A-Za-z0-9]{32}(?![A-Za-z0-9_+/=.\-])')
UTF16_ASCII_RUN = re.compile(rb'(?:[\x01-\x7f]\x00){8}|(?:\x00[\x01-\x7f]){8}')
CHUNK = 2 * 1024 * 1024
OVERLAP = 8192
HERMES_MAGIC = bytes.fromhex('c61fbc03c103191f')
MAX_HERMES_FILE = 128 * 1024 * 1024
_public_sdk_policy=json.loads((pathlib.Path(__file__).resolve().parent.parent/'config/public-sdk-credential-shapes.json').read_text(encoding='utf8'))
PUBLIC_SDK_OPAQUE_DIGESTS=frozenset(_public_sdk_policy['opaqueSha256'])
if not PUBLIC_SDK_OPAQUE_DIGESTS or any(not re.fullmatch('[a-f0-9]{64}',item) for item in PUBLIC_SDK_OPAQUE_DIGESTS):
    raise ValueError('Invalid public SDK opaque-string policy')

def credential_categories(data, *, allow_start=True, allow_end=True):
    # Both Android resources and Windows/iOS tools can embed UTF-16 strings.
    # Keep invalid-byte boundaries: dropping them can manufacture a 32-byte
    # opaque key from unrelated bytes in DEX, images or native machine code.
    texts = [data.decode('utf8', errors='replace')]
    # Every supported credential has at least eight consecutive ASCII chars.
    # Avoid four expensive Unicode scans of native code with no such UTF-16 run.
    if UTF16_ASCII_RUN.search(data):
        for offset in (0, 1):
            texts.append(data[offset:].decode('utf-16-le', errors='replace'))
            texts.append(data[offset:].decode('utf-16-be', errors='replace'))
    found = set()
    for original in texts:
        for text in (original, unquote(original)) if '%' in original else (original,):
            for category, pattern in PATTERNS.items():
                if pattern.search(text): found.add(category)
            for match in OPAQUE_KEY.finditer(text):
                # A streaming window boundary is not a token boundary. The
                # overlap/next window determines whether the token continues.
                if (not allow_start and match.start()==0) or (not allow_end and match.end()==len(text)):continue
                value = match.group()
                counts = Counter(value)
                entropy = -sum((n/32)*math.log2(n/32) for n in counts.values())
                if (sum(c.isupper() for c in value)>=4 and sum(c.islower() for c in value)>=4
                    and sum(c.isdigit() for c in value)>=4 and len(counts)>=20 and entropy>=4.4):
                    # Exact public SDK constants are not provider credentials.
                    # This exception never applies to any contextual pattern.
                    if hashlib.sha256(value.encode()).hexdigest() not in PUBLIC_SDK_OPAQUE_DIGESTS:
                        found.add('opaque-provider-key')
    return sorted(found)

def scan_raw_chunks(stream, chunk):
    found=set(); tail=b''; first=True
    while chunk:
        following=stream.read(CHUNK)
        data=tail+chunk
        found.update(credential_categories(data,allow_start=first,allow_end=not following))
        tail=data[-OVERLAP:]
        first=False;chunk=following
    return sorted(found)

def scan_hermes(data):
    # Pinned Hermes v98 layout (hermes-compiler 250829098.0.17). Its string
    # storage has no separators and may share substrings; raw regexes must not
    # join unrelated constants into an apparent credential-bearing URL.
    # https://github.com/facebook/hermes/blob/hermes-v250829098.0.17/include/hermes/BCGen/HBC/BytecodeFileFormat.h
    if len(data)<148 or len(data)>MAX_HERMES_FILE:
        raise ValueError('Invalid Hermes credential-scan input')
    version=struct.unpack_from('<I',data,8)[0]
    fields=struct.unpack_from('<20I',data,32)
    length,_,functions,kinds,identifiers,strings,overflows,storage_size=fields[:8]
    table=128+12*functions+4*kinds+4*identifiers
    overflow_table=table+4*strings
    storage=overflow_table+8*overflows
    end=storage+storage_size
    if version!=98 or length!=len(data) or end>len(data)-20:
        raise ValueError('Unsupported or malformed Hermes credential-scan input')
    if hashlib.sha1(data[:-20]).digest()!=data[-20:]:
        raise ValueError('Hermes credential-scan integrity check failed')
    found=set(); covered=[]
    for i in range(strings):
        entry=struct.unpack_from('<I',data,table+4*i)[0]
        utf16=entry&1; offset=(entry>>1)&0x7fffff; size=entry>>24
        if size==255:
            if offset>=overflows: raise ValueError('Invalid Hermes overflow string')
            offset,size=struct.unpack_from('<II',data,overflow_table+8*offset)
        byte_size=size*(2 if utf16 else 1)
        if offset+byte_size>storage_size: raise ValueError('Invalid Hermes string range')
        if byte_size:
            found.update(credential_categories(data[storage+offset:storage+offset+byte_size]))
            covered.append((offset,offset+byte_size))
    # All remaining bytes still pass the normal binary scanner, including
    # unreferenced string storage, bytecode, debug data and the file footer.
    for part in (data[:storage],data[end:]):
        stream=io.BytesIO(part)
        found.update(scan_raw_chunks(stream,stream.read(CHUNK)))
    cursor=0
    for start,stop in sorted(covered):
        if start>cursor:
            gap=io.BytesIO(data[storage+cursor:storage+start])
            found.update(scan_raw_chunks(gap,gap.read(CHUNK)))
        cursor=max(cursor,stop)
    if cursor<storage_size:
        gap=io.BytesIO(data[storage+cursor:end])
        found.update(scan_raw_chunks(gap,gap.read(CHUNK)))
    return sorted(found)

def scan_stream(stream):
    first=stream.read(CHUNK)
    if first.startswith(HERMES_MAGIC):
        data=first+stream.read(MAX_HERMES_FILE+1-len(first))
        return scan_hermes(data)
    return scan_raw_chunks(stream,first)

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
