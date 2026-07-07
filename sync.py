import requests, time, os, sys

TOKEN   = os.environ["GH_TOKEN"]
PASTA   = os.environ["PASTA"]
REPO_SRC= os.environ["REPO_SRC"]
EXCLUIR = os.environ.get("EXCLUIR", "").split(",")

HEADERS     = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github.v3+json"}
REPO_PAINEL = "felipetaiar/vetvida-painel"

def listar():
    r = requests.get(f"https://api.github.com/repos/{REPO_SRC}/git/trees/main?recursive=1", headers=HEADERS)
    r.raise_for_status()
    return [f["path"] for f in r.json().get("tree", []) if f["type"] == "blob"]

def get_content(path):
    r = requests.get(f"https://api.github.com/repos/{REPO_SRC}/contents/{path}", headers=HEADERS)
    return r.json().get("content", "").replace("\n", "") if r.status_code == 200 else None

def get_sha(path):
    r = requests.get(f"https://api.github.com/repos/{REPO_PAINEL}/contents/{path}", headers=HEADERS)
    return r.json().get("sha") if r.status_code == 200 else None

def upload(path, content, sha=None):
    body = {"message": f"sync: {PASTA}/{path}", "content": content, "branch": "main"}
    if sha:
        body["sha"] = sha
    r = requests.put(f"https://api.github.com/repos/{REPO_PAINEL}/contents/{path}", headers=HEADERS, json=body)
    return r.status_code in [200, 201]

ok = err = 0
for path in listar():
    if path in EXCLUIR:
        continue
    dest = f"{PASTA}/{path}"
    content = get_content(path)
    if not content:
        continue
    sha = get_sha(dest)
    if upload(dest, content, sha):
        print(f"  OK {dest}")
        ok += 1
    else:
        print(f"  ERRO {dest}")
        err += 1
    time.sleep(0.3)

print(f"\nSync {PASTA}: {ok} ok, {err} erros")
if err > 0:
    sys.exit(1)
