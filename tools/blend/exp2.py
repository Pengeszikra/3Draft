exec(open('extract.py').read())
import colorsys
KEYCOL={(3,20):'#e9e4d8',(7,12):'#5a3d2b',(7,11):'#6e4a33',(12,27):'#9fb4c4',(12,29):'#c9b79a',(9,12):'#8c8c88',(6,14):'#9a968c',
 (28,10):'#6b6f75',(30,10):'#4f5358',(29,10):'#7b8087',(32,16):'#8a5a36',(32,32):'#a56f43',(32,0):'#74482b',(12,26):'#d8d2c4',(12,18):'#2b2d31',
 (2,25):'#d6a37f',(7,29):'#3d5a80',(7,13):'#4a3a2e',(12,19):'#222',(8,15):'#6a4630',(7,9):'#52392a',(12,28):'#b8a98c',(10,29):'#cdbd9f',(11,29):'#c4b394'}
def col(k):
    if k in KEYCOL: return KEYCOL[k]
    h=0.08+((k[0]*0.618+k[1]*0.37)%1)*0.08; r,g,b=colorsys.hls_to_rgb(h,0.55+((k[1]%5)-2)*0.04,0.22)
    return '#%02x%02x%02x'%(int(r*255),int(g*255),int(b*255))
def sub(a,b):return [a[i]-b[i] for i in range(3)]
def cr(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dt(a,b):return sum(x*y for x,y in zip(a,b))
def newell(P):
    n=[0,0,0]
    for i in range(len(P)):
        a,b=P[i],P[(i+1)%len(P)]
        n[0]+=(a[1]-b[1])*(a[2]+b[2]); n[1]+=(a[2]-b[2])*(a[0]+b[0]); n[2]+=(a[0]-b[0])*(a[1]+b[1])
    return n
def convex(P,n):
    for i in range(len(P)):
        a,b,c=P[i],P[(i+1)%len(P)],P[(i+2)%len(P)]
        if dt(cr(sub(b,a),sub(c,b)),n)<-1e-9: return False
    return True
def planar(P,n):
    l=math.sqrt(dt(n,n))
    if l<1e-12: return False
    return all(abs(dt(sub(p,P[0]),n))/l<1e-5 for p in P)
def tri_ear(idx,pos,n):
    idx=list(idx);out=[]
    guard=0
    while len(idx)>3 and guard<1000:
        guard+=1;ok=False
        for i in range(len(idx)):
            a,b,c=idx[i-1],idx[i],idx[(i+1)%len(idx)]
            A,B,C=pos[a],pos[b],pos[c]
            if dt(cr(sub(B,A),sub(C,B)),n)<=1e-12: continue
            inside=False
            for j in idx:
                if j in(a,b,c):continue
                Pp=pos[j]
                s1=dt(cr(sub(B,A),sub(Pp,A)),n);s2=dt(cr(sub(C,B),sub(Pp,B)),n);s3=dt(cr(sub(A,C),sub(Pp,C)),n)
                if s1>=0 and s2>=0 and s3>=0: inside=True;break
            if inside: continue
            out.append([a,b,c]); idx.pop(i); ok=True; break
        if not ok: break
    if len(idx)==3: out.append(idx)
    return out
OBs=[i for i,b in enumerate(blocks) if b[0]=='OB']
objs=[];stats=collections.Counter();palette={}
for i in OBs:
    o=read_struct(blocks[i][3],blocks[i][1])
    if o['type']!=1 or o['base_flag'] not in (214,198,726) or not o['data']: continue
    try: name,pos,cv,off,uv=mesh_data(ids[o['data']])
    except Exception: stats['skipped']+=1; continue
    W=world_mat(o)
    wp=[]
    for p in pos:
        x=[sum(W[r][c]*p[c] for c in range(3))+W[r][3] for r in range(3)]
        wp.append([x[0],x[2],-x[1]])
    # det sign: mirrored objects flip winding
    det=dt([W[0][0],W[1][0],W[2][0]],cr([W[0][1],W[1][1],W[2][1]],[W[0][2],W[1][2],W[2][2]]))
    flip=det<0
    faces=[]
    for f in range(len(off)-1):
        a,b=off[f],off[f+1]; idx=list(cv[a:b])
        if flip: idx.reverse()
        k=(0,0)
        if uv: k=(int(sum(uv[t][0] for t in range(a,b))/(b-a)*32),int(sum(uv[t][1] for t in range(a,b))/(b-a)*32))
        c='#7d9b4e' if o['id']['name'][2:]=='Telek' else col(k); palette[c]=list(k)
        P=[wp[j] for j in idx]; n=newell(P)
        if len(idx)==3: faces.append({'v':idx,'color':c}); continue
        if planar(P,n) and convex(P,n): faces.append({'v':idx,'color':c}); stats['ngon-ok']+=1; continue
        if len(idx)==4 and planar(P,n) is False:
            faces.append({'v':[idx[0],idx[1],idx[2]],'color':c});faces.append({'v':[idx[0],idx[2],idx[3]],'color':c});continue
        for t in tri_ear(idx,wp,n): faces.append({'v':t,'color':c})
        stats['triangulated']+=1
    objs.append({'name':o['id']['name'][2:].replace('.','-'),'mesh':{'positions':[[round(v,5) for v in p] for p in wp],'faces':faces}})
json.dump({'objects':objs,'palette':palette},open('house.raw.json','w'),separators=(',',':'))
print(len(objs),stats,sum(len(o['mesh']['faces']) for o in objs))
