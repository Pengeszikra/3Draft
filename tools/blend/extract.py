exec(open('q13.py').read().split("# collections")[0])
import math, json, collections
def f32s(db,n,k): return struct.unpack_from('<%df'%(n*k),d,db[3])
def i32s(db,n): return struct.unpack_from('<%di'%n,d,db[3])
def mesh_data(i):
    me=blocks[i]; m=read_struct(me[3],me[1]); S=sc(i); A=attrs_s(S,m)
    n,db=attr_data(S,A['position']); P=f32s(db,n,3); pos=[P[k:k+3] for k in range(0,len(P),3)]
    n,db=attr_data(S,A['.corner_vert']); cv=i32s(db,n)
    off=struct.unpack_from('<%di'%(m['totpoly']+1),d,S[m['poly_offset_indices']][3])
    uv=None
    if 'UVMap' in A:
        n,db=attr_data(S,A['UVMap']); U=f32s(db,n,2); uv=[U[k:k+2] for k in range(0,len(U),2)]
    mi=None
    if 'material_index' in A:
        n,db=attr_data(S,A['material_index']); mi=i32s(db,n)
    return m['id']['name'][2:],pos,cv,off,uv
def mat_mul(a,b): return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def eul_to_mat(r,mode):
    cx,cy,cz=[math.cos(x) for x in r]; sx,sy,sz=[math.sin(x) for x in r]
    X=[[1,0,0],[0,cx,-sx],[0,sx,cx]]; Y=[[cy,0,sy],[0,1,0],[-sy,0,cy]]; Z=[[cz,-sz,0],[sz,cz,0],[0,0,1]]
    mm=lambda A,B:[[sum(A[i][k]*B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mm(Z,mm(Y,X))  # XYZ euler (rotmode 1)
def quat_to_mat(q):
    w,x,y,z=q; 
    return [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
obj_by_ptr={}
def local_mat(o):
    loc=[a+b for a,b in zip(o['loc'],o['dloc'])]
    R=quat_to_mat(o['quat']) if o['rotmode']==0 else eul_to_mat(o['rot'],o['rotmode'])
    sz=o['size']; sd=o['dscale']
    s=[a*b for a,b in zip(sz,sd)]
    M=[[R[i][0]*s[0],R[i][1]*s[1],R[i][2]*s[2],loc[i]] for i in range(3)]+[[0,0,0,1]]
    return M
def world_mat(o):
    L=local_mat(o)
    if o['parent']:
        pi=ids[o['parent']]; po=read_struct(blocks[pi][3],blocks[pi][1])
        pm=world_mat(po); pinv=o['parentinv']
        P=[list(pinv[c*4:(c+1)*4]) for c in range(4)] if isinstance(pinv[0],(int,float)) else pinv
        # DNA matrices are column-major float[4][4]: m[col][row]
        PI=[[pinv[c][r] for c in range(4)] for r in range(4)]
        return mat_mul(pm,mat_mul(PI,L))
    return L
