#!/usr/bin/env python3
"""Guarda secreto de staging fuera del repo y comprueba acceso de servidor."""
import getpass, json, os, pathlib, urllib.request, urllib.error
folder=pathlib.Path.home()/'.config/nora-staging'
config=json.loads((folder/'api.json').read_text())
assert config['url']=='https://ccccntecmouklhdvbqjp.supabase.co'
secret=getpass.getpass('Pegá la Secret key o service_role de NORA EBA (no se muestra): ').strip()
if not secret or '\n' in secret or '\r' in secret:
    raise SystemExit('Clave inválida. No se guardó nada.')
headers={'apikey':secret}
if not secret.startswith('sb_secret_'):
    headers['Authorization']='Bearer '+secret
req=urllib.request.Request(config['url']+'/rest/v1/servicio_avisos?select=servicio_id&limit=1',headers=headers)
try:
    with urllib.request.urlopen(req,timeout=15) as r:
        rows=json.load(r)
        if r.status!=200 or not isinstance(rows,list) or not rows:
            raise SystemExit('No se comprobó acceso de servidor a los avisos QA. No se guardó nada.')
except urllib.error.URLError:
    raise SystemExit('La clave no pudo validarse en Nora EBA. No se guardó nada.') from None
p=folder/'server.json'
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f: json.dump({'SUPABASE_SERVICE_ROLE_KEY':secret},f)
os.chmod(p,0o600)
print('Clave de servidor validada y guardada localmente. No se enviaron mensajes ni se modificó la base.')
