import sys,glob
ids=[l.split('\t')[0] for l in open('in_6.txt') if l.strip()]
valid=set("security foreign justice criminal religion governance economy consumer welfare labor housing health education environment transport arab settlement rights immigration heritage local media agriculture other".split())
m={}
for f in sorted(glob.glob('spec_6_*.txt')):
    for l in open(f):
        l=l.strip()
        if not l: continue
        r,c=l.split()
        a,b=(r.split('-')+[r])[:2] if '-' in r else (r,r)
        p,s=(c.split('/')+[''])[:2]
        assert p in valid and (s=='' or s in valid),l
        for i in range(int(a),int(b)+1): m[str(i)]=(p,s)
with open('out_6.tsv','w') as o:
    for i in ids:
        if i in m: o.write(f"{i}\t{m[i][0]}\t{m[i][1]}\n")
missing=[i for i in ids if i not in m]
print(len(ids),len(m),len(missing),missing[:5],missing[-3:])
