"""Binary checks independent of signing tools. Never print bundle contents."""
import hashlib, json, re, struct, pathlib

def require(value, message):
    if not value: raise ValueError(message)

def dex_startup(archive, prefix='', required_methods=None):
    wanted={'Llivekit/org/jni_zero/JniInit;':{'init'},'Lexpo/modules/adapters/react/apploader/RNHeadlessAppLoader;':{'<init>'}}
    for desc, methods in (required_methods or {}).items():wanted.setdefault(desc,set()).update(methods)
    found=set()
    for name in archive.namelist():
        if not re.fullmatch(re.escape(prefix)+r'classes\d*\.dex',name): continue
        b=archive.read(name);require(b[:4]==b'dex\n','Unsupported DEX format')
        u32=lambda p:struct.unpack_from('<I',b,p)[0]
        def string(index):
            p=u32(u32(60)+index*4)
            while b[p]&128:p+=1
            p+=1
            return b[p:b.index(b'\0',p)].decode('utf8',errors='replace')
        types=u32(68);methods=u32(92)
        def uleb(p):
            value=0
            for shift in range(0,35,7):
                part=b[p];p+=1;value|=(part&127)<<shift
                if not part&128:return value,p
            raise ValueError('Invalid DEX class data')
        for i in range(u32(96)):
            entry=u32(100)+i*32;kind=u32(entry);desc=string(u32(types+kind*4))
            if desc not in wanted:continue
            cursor=u32(entry+24)
            if not cursor:continue
            sizes=[]
            for _ in range(4):value,cursor=uleb(cursor);sizes.append(value)
            for _ in range(sizes[0]+sizes[1]):
                _,cursor=uleb(cursor);_,cursor=uleb(cursor)
            for size in sizes[2:]:
                method_index=0
                for _ in range(size):
                    delta,cursor=uleb(cursor);method_index+=delta
                    _,cursor=uleb(cursor);code,cursor=uleb(cursor)
                    at=methods+method_index*8
                    method_name=string(u32(at+4))
                    if code and struct.unpack_from('<H',b,at)[0]==kind and method_name in wanted[desc]:found.add((desc,method_name))
    required={(desc,method) for desc,methods in wanted.items() for method in methods}
    require(found==required,'Missing DEX startup class definition/method: '+', '.join(desc+'#'+method for desc,method in sorted(required-found)))
    return sorted(wanted)

def elf_alignment(b, name):
    require(b[:4]==b'\x7fELF' and b[5]==1,'Invalid little-endian ELF: '+name)
    bits=b[4];require(bits in (1,2),'Unsupported ELF class: '+name)
    offset=struct.unpack_from('<Q' if bits==2 else '<I',b,32 if bits==2 else 28)[0]
    size,count=struct.unpack_from('<HH',b,54 if bits==2 else 42)
    loads=[]
    for i in range(count):
        p=offset+i*size
        if struct.unpack_from('<I',b,p)[0]!=1:continue
        alignment=struct.unpack_from('<Q' if bits==2 else '<I',b,p+(48 if bits==2 else 28))[0];loads.append(alignment)
    require(loads,'ELF has no load segments: '+name)
    # Android 16 KB systems run the 64-bit ABIs. 32-bit remains supported on 4 KB devices.
    if '/arm64-v8a/' in name or '/x86_64/' in name:require(min(loads)>=16384,'ELF segment is not 16 KB aligned: '+name)

def native_libraries(archive,prefix='lib/'):
    names=[n for n in archive.namelist() if n.startswith(prefix) and n.endswith('.so')]
    require(names,'Artifact has no native libraries')
    abis={n.split('/')[1 if prefix=='lib/' else 2] for n in names}
    require('arm64-v8a' in abis,'Release lacks arm64-v8a')
    for name in names:elf_alignment(archive.read(name),name)
    return sorted(abis)

def classify_dev_strings(data):
    text=data.decode('utf8',errors='ignore')
    counts={'frameworkConstants':len(re.findall(r'localhost:8081|10\.0\.2\.2',text)),
            'spotubeLoopback':len(re.findall(r'(?:ws?://)?127\.0\.0\.1',text)),
            'executableDevRoutes':len(re.findall(r'''(?:fetch|WebSocket|axios\.(?:get|post))\s*\(\s*["'`](?:https?|ws)://(?:localhost|10\.0\.2\.2)(?::\d+)?(?:/|["'`])|(?:fetch|axios\.(?:get|post))\s*\(\s*["'`]https?://127\.0\.0\.1(?::\d+)?(?:/|["'`])|WebSocket\s*\(\s*["'`]ws://127\.0\.0\.1:8081/(?:debugger-proxy|symbolicate|status|index\.bundle)''',text))}
    require(not counts['executableDevRoutes'],'Executable development route in release')
    return counts

def embedded_inputs(data,release,commit=None):
    inputs=json.loads(data)
    for key in ['version','build','applicationId']:require(inputs.get(key)==release[key],'Embedded release input mismatch: '+key)
    require(re.fullmatch(r'[a-f0-9]{40}',inputs.get('commit','')),'Missing embedded commit')
    if commit:require(inputs['commit']==commit,'Embedded source commit mismatch')
    for key in ['lockfileSha256','inputsFingerprint','publicConfigFingerprint']:require(re.fullmatch(r'[a-f0-9]{64}',inputs.get(key,'')),'Missing input fingerprint: '+key)
    require(not inputs.get('flags',{}).get('testAds',True),'Release input enables test ads')
    return inputs

def archive_dev_strings(archive):
    totals={'scannedFiles':0,'frameworkConstants':0,'spotubeLoopback':0,'executableDevRoutes':0}
    for member in archive.infolist():
        if member.is_dir():continue
        name=member.filename
        # Include native executables, dylibs/DEX and resources as well as JS.
        if not (name.endswith(('.bundle','.jsbundle','.so','.dylib','.dex','.arsc','.xml','.plist','.json')) or '.' not in pathlib.PurePosixPath(name).name):continue
        counts=classify_dev_strings(archive.read(member))
        totals['scannedFiles']+=1
        for key,value in counts.items():totals[key]+=value
    return totals
