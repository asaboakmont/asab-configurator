"""Lossless full-catalogue merging with exhaustive indexed-attribute validation.
Original files are read only. Output must be a different directory.
Requires Python 3 and NumPy. Reuses the verified pilot merge implementation.
"""
from pathlib import Path
import argparse,collections,hashlib,json,struct,time
import numpy as np
from mergeNativePilot import merge,DTYPES,WIDTHS

def document(path):
    raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
    def read(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dt=np.dtype(DTYPES[a['componentType']]);width=WIDTHS[a['type']]
        return np.ndarray((a['count'],width),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*width),dt.itemsize)).copy()
    return doc,read

def validate(source,target):
    a,ra=document(source);b,rb=document(target)
    for key in ('nodes','scenes','scene','materials'):assert a.get(key)==b.get(key),(source.name,key)
    assert len(a['meshes'])==len(b['meshes'])
    for ma,mb in zip(a['meshes'],b['meshes']):
        assert ma.get('name')==mb.get('name')
        def grouped(mesh,doc,read):
            groups=collections.defaultdict(list)
            for p in mesh['primitives']:
                layout=tuple((name,doc['accessors'][i]['componentType'],doc['accessors'][i]['type'],doc['accessors'][i].get('normalized',False)) for name,i in sorted(p['attributes'].items()))
                groups[(p.get('material'),layout)].append(p)
            return {key:{name:np.concatenate([read(p['attributes'][name])[read(p['indices']).ravel()] for p in ps]) for name,*_ in key[1]} for key,ps in groups.items()}
        ga=grouped(ma,a,ra);gb=grouped(mb,b,rb);assert ga.keys()==gb.keys()
        for key in ga:
            for name in ga[key]:
                x,y=ga[key][name],gb[key][name]
                assert np.isfinite(x).all() and np.isfinite(y).all()
                assert np.array_equal(x,y),(source.name,ma.get('name'),name)
    return True

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    repo=args.repo.resolve();output=args.output.resolve();source_root=(repo/'public/models/catalogue').resolve()
    assert output!=source_root and source_root not in output.parents,'Use a separate output directory'
    rows=json.loads((repo/'data/nativeCatalogue.json').read_text());assert len(rows)==335
    report=[];start=time.time()
    for i,row in enumerate(rows):
        source=(repo/'public'/row['modelUrl'].lstrip('/')).resolve();assert source_root in source.parents
        relative=source.relative_to(source_root);target=output/relative
        entry=merge(source,target,generator='ASAB catalogue: lossless per-part/material face merging')
        validate(source,target)
        entry['collection']=row['collection'];entry['modelUrl']='/models/catalogue-optimized/'+relative.as_posix();entry['validated']=True
        entry['optimizedBytes']=entry.pop('pilotBytes');entry['optimizedPrimitives']=entry.pop('pilotPrimitives');entry['optimizedSha256']=entry.pop('pilotSha256')
        report.append(entry)
        if (i+1)%25==0 or i+1==len(rows):print(f'{i+1}/{len(rows)} merged and validated',flush=True)
    summary={'models':len(report),'seconds':round(time.time()-start,2),'originalBytes':sum(r['sourceBytes'] for r in report),'optimizedBytes':sum(r['optimizedBytes'] for r in report),'originalPrimitives':sum(r['sourcePrimitives'] for r in report),'optimizedPrimitives':sum(r['optimizedPrimitives'] for r in report),'triangles':sum(r['triangles'] for r in report)}
    (output/'optimization-report.json').write_text(json.dumps({'summary':summary,'models':report},indent=2)+'\n');print(json.dumps(summary),flush=True)
