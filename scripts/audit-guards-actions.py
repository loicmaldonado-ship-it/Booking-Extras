# BUG-02 : inventaire statique des Server Actions qui utilisent createAdminClient().
# Pour chaque action exportée d un fichier "use server", indique le contrôle d accès (direct ou via un helper
# qui en appelle un) trouvé avant la première écriture. Usage : python3 scripts/audit-guards-actions.py docs/bug02-inventaire-actions-2026-10-30.json
import re,glob,json,sys
BASE=["getCurrentProfile","checkProjetAccess","getCurrentFigurant","getFigurantIdByToken","staffDossier","bearerDossier","getAccessibleProjetIds","requireChef","requireOwner","hasSectionAccess","getCurrentFigurantId","requireStaffMessageAccess"]
files=sorted(glob.glob("src/**/*.ts",recursive=True)+glob.glob("src/**/*.tsx",recursive=True))
srcs={f:open(f).read() for f in files}
FN=re.compile(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(|(?:export\s+)?const\s+(\w+)\s*=\s*(?:cache\()?\s*async")
def bodies(s):
    ms=list(FN.finditer(s))
    for i,m in enumerate(ms):
        end=ms[i+1].start() if i+1<len(ms) else len(s)
        yield (m.group(1) or m.group(2)), s[m.end():end], m
guards=set(BASE)
for _ in range(6):
    added=False
    for f,s in srcs.items():
        for name,body,_ in bodies(s):
            if name in guards: continue
            if re.search(r"\b("+"|".join(map(re.escape,guards))+r")\s*\(",body):
                guards.add(name); added=True
    if not added: break
rx=re.compile(r"\b("+"|".join(map(re.escape,guards))+r")\s*\(")
res=[]
MUT=re.compile(r"\.(insert|update|delete|upsert|rpc|remove|upload|createSignedUploadUrl)\s*\(")
for f,s in srcs.items():
    if not re.search(r'^["\']use server["\']',s,re.M): continue
    for name,body,m in bodies(s):
        if not m.group(0).startswith("export"): continue
        a=body.find("createAdminClient(")
        if a<0: continue
        mm=MUT.search(body)
        cut=mm.start() if mm else len(body)
        g=rx.search(body[:cut])
        res.append({"file":f,"action":name,"guard":g.group(1) if g else None,"mutates":bool(mm),"guard_before_admin":bool(rx.search(body[:a]))})
bad=[r for r in res if not r["guard"]]
json.dump(res,open(sys.argv[1],"w"),ensure_ascii=False,indent=1)
print(len(res),"actions admin ;",len(bad),"sans aucun contrôle avant la 1re écriture (ou du tout si lecture seule)")
for r in bad: print(" ",r["file"],r["action"])
