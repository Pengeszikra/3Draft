import struct, sys, collections
F="/mnt/user-data/attachments/82cdf3f0-a2ed-5001-a778-0ddee66fc4d8/8f66e6a9-totsarok-1-egy-anyag.blend"
d=open(F,'rb').read()
pos=17
blocks=[]  # (code, sdna, old, off, len, nr)
while pos<len(d):
    code=d[pos:pos+4].decode('latin1').rstrip('\0'); sdna,old,ln,nr=struct.unpack_from('<iQqq',d,pos+4)
    off=pos+32
    blocks.append((code,sdna,old,off,ln,nr)); pos=off+ln
    if code=='ENDB': break
print(len(blocks),'blocks')
cnt=collections.Counter(b[0] for b in blocks); print(cnt.most_common(40))

# ---- SDNA
dna=[b for b in blocks if b[0]=='DNA1'][0]
o=dna[3]; base0=dna[3]
al=lambda x:((x-base0+3)&~3)+base0
assert d[o:o+4]==b'SDNA'; o+=4
assert d[o:o+4]==b'NAME'; o+=4
n,=struct.unpack_from('<i',d,o); o+=4
names=[]
for _ in range(n):
    e=d.index(b'\0',o); names.append(d[o:e].decode()); o=e+1
o=al(o)
assert d[o:o+4]==b'TYPE'; o+=4
n,=struct.unpack_from('<i',d,o); o+=4
types=[]
for _ in range(n):
    e=d.index(b'\0',o); types.append(d[o:e].decode()); o=e+1
o=al(o)
assert d[o:o+4]==b'TLEN'; o+=4
tlen=list(struct.unpack_from('<%dh'%len(types),d,o)); o+=2*len(types); o=al(o)
assert d[o:o+4]==b'STRC'; o+=4
n,=struct.unpack_from('<i',d,o); o+=4
structs=[]  # (typename, [(typeidx,nameidx)])
for _ in range(n):
    t,nf=struct.unpack_from('<hh',d,o); o+=4
    fl=[]
    for _ in range(nf):
        a,b=struct.unpack_from('<hh',d,o); o+=4; fl.append((a,b))
    structs.append((types[t],t,fl))
sbyname={s[0]:i for i,s in enumerate(structs)}
byold={}
for b in blocks: byold[b[2]]=b
import re
PRIM={'char':('b',1),'uchar':('B',1),'short':('h',2),'ushort':('H',2),'int':('i',4),'uint':('I',4),'float':('f',4),'double':('d',8),'int64_t':('q',8),'uint64_t':('Q',8),'int8_t':('b',1),'uint8_t':('B',1)}
def tsize(ti):
    return tlen[ti]
def read_struct(off, si):
    name,ti,fl=structs[si]
    out={}; p=off
    for (a,b) in fl:
        nm=names[b]; tn=types[a]
        ptr=nm.startswith('*'); base=nm.lstrip('*')
        arr=re.findall(r'\[(\d+)\]',base); base=re.sub(r'\[\d+\]','',base)
        cnt=1
        for x in arr: cnt*=int(x)
        if base.startswith('(') : base=base  # func ptr
        if ptr or nm.startswith('('):
            sz=8; vals=struct.unpack_from('<%dQ'%cnt,d,p); out[base]=vals[0] if cnt==1 else list(vals); p+=sz*cnt; continue
        if tn in PRIM:
            f,sz=PRIM[tn]
            if tn=='char' and arr:
                raw=d[p:p+cnt]; out[base]=raw.split(b'\0')[0].decode('latin1')
            else:
                vals=struct.unpack_from('<%d%s'%(cnt,f),d,p); out[base]=vals[0] if cnt==1 else list(vals)
            p+=sz*cnt
        elif tn in sbyname:
            sz=tsize(a)
            if cnt==1: out[base]=read_struct(p,sbyname[tn])
            else: out[base]=[read_struct(p+i*sz,sbyname[tn]) for i in range(cnt)]
            p+=sz*cnt
        else:
            sz=tsize(a); p+=sz*cnt
    return out
def deref(ptr, si=None):
    b=byold.get(ptr)
    if not b: return None
    return read_struct(b[3], b[1] if si is None else si)
def listbase(lb, si):
    out=[]; p=lb['first']; seen=set()
    while p and p not in seen:
        seen.add(p); b=byold.get(p)
        if not b: break
        s=read_struct(b[3], si); out.append(s); p=s.get('next')
    return out
