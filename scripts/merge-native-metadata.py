"""Maintenance only: share reviewed POM/module checksums, never SDK binaries.

The app dependency locks and native store selectors remain separate. Conflicting
hashes fail instead of accepting another checksum for an existing artifact.
Run only after reviewing the native captures; production CI must not call this.
"""
import copy
import json
from pathlib import Path
import xml.etree.ElementTree as ET

FILES = [Path('config/native-locks/play/verification-metadata.xml'),
         Path('config/native-locks/amazon/verification-metadata.xml'),
         Path('companions/wear/gradle/verification-metadata.xml')]
trees = {p: ET.parse(p) for p in FILES}
ns = trees[FILES[0]].getroot().tag.split('}')[0][1:]
ET.register_namespace('', ns)
tag = lambda name: '{' + ns + '}' + name
metadata = {}
metadata_only = set()
has_binary = set()
for file, tree in trees.items():
    for component in tree.getroot().find(tag('components')):
        coordinate = tuple(component.get(k) for k in ('group', 'name', 'version'))
        if all(a.get('name', '').endswith(('.pom', '.module')) for a in component):
            metadata_only.add(coordinate)
        else:
            has_binary.add(coordinate)
        for artifact in component:
            if not artifact.get('name', '').endswith(('.pom', '.module')):
                continue
            key = coordinate + (artifact.get('name'),)
            hashes = {c.get('value') for c in artifact if c.tag == tag('sha256')}
            if not hashes:
                raise ValueError('Missing metadata SHA-256: ' + str(key))
            if key in metadata and metadata[key]['hashes'] != hashes:
                raise ValueError('Conflicting captured metadata hashes: ' + str(key))
            metadata.setdefault(key, {'artifact': artifact, 'hashes': hashes, 'sources': []})['sources'].append(str(file).replace('\\', '/'))
metadata_only -= has_binary
counts = {}
added = set()
for file, tree in trees.items():
    components = tree.getroot().find(tag('components'))
    indexed = {tuple(c.get(k) for k in ('group', 'name', 'version')): c for c in components}
    count = 0
    for key, value in sorted(metadata.items()):
        coordinate = key[:3]
        # Wear gets its existing coordinates and parent/BOM metadata. Do not
        # broaden the watch capture to every phone SDK's metadata.
        if file == FILES[2] and coordinate not in indexed and coordinate not in metadata_only:
            continue
        component = indexed.get(coordinate)
        if component is None:
            component = ET.SubElement(components, tag('component'), dict(zip(('group', 'name', 'version'), coordinate)))
            indexed[coordinate] = component
        if not any(a.get('name') == key[3] for a in component):
            component.append(copy.deepcopy(value['artifact']))
            count += 1
            added.add(key)
    ET.indent(tree, space='   ')
    tree.write(file, encoding='UTF-8', xml_declaration=True)
    counts[str(file).replace('\\', '/')] = count
origin_file = Path('config/native-locks/shared-metadata-origins.json')
records = {}
if origin_file.exists():
    for record in json.loads(origin_file.read_text())['records']:
        key = tuple(record[k] for k in ('group', 'name', 'version', 'artifact'))
        if key not in metadata or set(record['sha256']) != metadata[key]['hashes']:
            raise ValueError('Previously reviewed metadata changed: ' + str(key))
        records[key] = record
for key in added:
    value = metadata[key]
    records.setdefault(key, dict(group=key[0], name=key[1], version=key[2], artifact=key[3], sha256=sorted(value['hashes']), captures=value['sources']))
origin_file.write_text(json.dumps({
    'scope': 'Reviewed metadata only; store SDK binaries and dependency lockfiles remain separate',
    'records': [record for key, record in sorted(records.items())]
}, indent=2) + '\n')
print(json.dumps({'metadataArtifacts': len(metadata), 'addedByCapture': counts}))
