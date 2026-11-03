exec(open('blend.py').read())
scopes={}   # index of id block -> {old: block}
owner=[]    # block index -> scope key
cur=None
for i,b in enumerate(blocks):
    if b[0]!='DATA':
        cur=i; scopes[cur]={}
    scopes[cur][b[2]]=b
    owner.append(cur)
def sc(i): return scopes[owner[i]]
def cstr_s(S,p):
    b=S.get(p)
    return d[b[3]:b[3]+b[4]].split(b'\0')[0].decode('latin1') if b else None
def attrs_s(S,m):
    st=m['attribute_storage']; out={}
    b=S.get(st['dna_attributes'])
    if not b: return out
    sz=tlen[structs[sbyname['Attribute']][1]]
    for i in range(st['dna_attributes_num']):
        a=read_struct(b[3]+i*sz, sbyname['Attribute'])
        out[cstr_s(S,a['name'])]=a
    return out
def attr_data(S,a):
    ab=S.get(a['data'])
    if a['storage_type']==0:
        arr=read_struct(ab[3],sbyname['AttributeArray']); db=S.get(arr['data'])
        return arr['size'], db
    return None,None
