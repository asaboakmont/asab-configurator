"""Merge CAD face primitives per original part/material. Deliberately limited to two pilot assets.
No decimation, welding, pivot edits, material changes or source-file replacement.
"""
from pathlib import Path
import argparse, collections, hashlib, json, struct
import numpy as np
PILOT = ('ASAB-CI-1U-RAFT-W0600-JPN', 'ASAB-CS-1U-RAFT-W0600-JPN')
DTYPES = {5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTHS = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def merge(source, target, generator="ASAB pilot: lossless per-part/material face merging"):
    raw=source.read_bytes(); n=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+n]); start=20+n
    length,kind=struct.unpack_from('<II',raw,start); assert kind==0x004e4942
    binary=raw[start+8:start+8+length]
    assert len(doc['buffers'])==1 and not any(k in doc for k in ('animations','skins','extensionsUsed'))
    def read(index):
        a=doc['accessors'][index]; assert 'sparse' not in a
        v=doc['bufferViews'][a['bufferView']]; dtype=np.dtype(DTYPES[a['componentType']]); width=WIDTHS[a['type']]
        offset=v.get('byteOffset',0)+a.get('byteOffset',0)
        return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=offset,strides=(v.get('byteStride',dtype.itemsize*width),dtype.itemsize)).copy()
    accessors=[]; views=[]; output=bytearray()
    def add(array, template, index=False):
        while len(output)%4:output.append(0)
        data=array.tobytes(); views.append({'buffer':0,'byteOffset':len(output),'byteLength':len(data),'target':34963 if index else 34962});output.extend(data)
        a={k:template[k] for k in ('componentType','type','normalized') if k in template}
        a.update(bufferView=len(views)-1,count=len(array))
        if not index and a['type']=='VEC3':a.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
        accessors.append(a);return len(accessors)-1
    before=after=triangles=0
    for mesh in doc['meshes']:
        groups=collections.defaultdict(list)
        for p in mesh['primitives']:
            assert p.get('mode',4)==4 and 'targets' not in p and 'indices' in p
            key=(p.get('material'),tuple((name,doc['accessors'][idx]['componentType'],doc['accessors'][idx]['type'],doc['accessors'][idx].get('normalized',False)) for name,idx in sorted(p['attributes'].items())))
            groups[key].append(p);before+=1;triangles+=doc['accessors'][p['indices']]['count']//3
        merged=[]
        for (material,attrs),parts in groups.items():
            attributes={};offset=0;indices=[]
            for p in parts:
                indices.append(read(p['indices']).astype('<u4')+offset);offset+=doc['accessors'][p['attributes']['POSITION']]['count']
            for name,*_ in attrs:
                arrays=[read(p['attributes'][name]) for p in parts]
                attributes[name]=add(np.concatenate(arrays),doc['accessors'][parts[0]['attributes'][name]])
            p={'attributes':attributes,'indices':add(np.concatenate(indices),{'componentType':5125,'type':'SCALAR'},True),'mode':4}
            if material is not None:p['material']=material
            merged.append(p);after+=1
        mesh['primitives']=merged
    doc['accessors']=accessors;doc['bufferViews']=views;doc['buffers']=[{'byteLength':len(output)}]
    doc['asset']['generator']=generator
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);output+=b'\0'*((-len(output))%4)
    result=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(output))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(output),0x004e4942)+output
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(result)
    return {'sku':source.stem,'sourceBytes':len(raw),'pilotBytes':len(result),'sourcePrimitives':before,'pilotPrimitives':after,'triangles':triangles,'sourceSha256':hashlib.sha256(raw).hexdigest(),'pilotSha256':hashlib.sha256(result).hexdigest()}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    report=[merge(args.repo/'public/models/catalogue/japandi'/f'{sku}.glb',args.output/f'{sku}.glb') for sku in PILOT]
    (args.output/'pilot-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
