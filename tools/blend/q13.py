exec(open('scope.py').read())
ids={b[2]:i for i,b in enumerate(blocks) if b[0]!='DATA'}
def idname(p):
    i=ids.get(p)
    if i is None: return None
    s=read_struct(blocks[i][3],blocks[i][1]); return s['id']['name'][2:] if 'id' in s else None
def lb_s(S,lb,sname):
    out=[]; p=lb['first']; seen=set()
    while p and p not in seen:
        seen.add(p); b=S.get(p) or (blocks[ids[p]] if p in ids else None)
        if not b: break
        s=read_struct(b[3],sbyname[sname]); out.append(s); p=s.get('next')
    return out
# collections
GR=[i for i,b in enumerate(blocks) if b[0]=='GR']
print('collections',len(GR))
cols={}
for i in GR:
    g=read_struct(blocks[i][3],blocks[i][1]); S=sc(i)
    objs=[idname(co['ob']) for co in lb_s(S,g['gobject'],'CollectionObject')]
    kids=[co['collection'] for co in lb_s(S,g['children'],'CollectionChild')]
    cols[blocks[i][2]]=(g['id']['name'][2:],g['flag'],objs,kids)
    print(g['id']['name'][2:],'flag',g['flag'],'objs',len(objs),'children',len(kids))
sci=[i for i,b in enumerate(blocks) if b[0]=='SC'][0]
s=read_struct(blocks[sci][3],blocks[sci][1]); S=sc(sci)
print('scene master',s['master_collection'], idname(s['master_collection']))
for vl in lb_s(S,s['view_layers'],'ViewLayer'):
    print('viewlayer',vl['name'])
    def walk(lc,depth=0):
        print('  '*depth, lc and idname(lc['collection']), 'flag', lc['flag'])
        for ch in lb_s(S,lc['layer_collections'],'LayerCollection'): walk(ch,depth+1)
    walk(vl['layer_collections'] and lb_s(S,vl['layer_collections'],'LayerCollection')[0])
