#!/usr/bin/env python3
"""Configura conexión local de staging. No modifica SQL ni imprime secretos."""
import getpass, os, pathlib, subprocess, tempfile
from urllib.parse import urlparse, unquote

REF = 'ccccntecmouklhdvbqjp'
def parse_staging_uri(raw):
    # urllib rejects literal square brackets in a password placeholder.
    try:
        u = urlparse(raw.strip().replace('[YOUR-PASSWORD]', '%5BYOUR-PASSWORD%5D'))
        valid = (u.scheme in ('postgres', 'postgresql')
                 and u.username == 'postgres.' + REF
                 and u.hostname and u.hostname.endswith('.pooler.supabase.com')
                 and u.port == 5432 and u.path == '/postgres'
                 and not u.fragment)
    except ValueError:
        raise ValueError('URI inválida. Copiá la URI completa de Session pooler de Nora EBA.') from None
    if not valid:
        raise ValueError('No corresponde al Session pooler de Nora EBA (staging). No se guardó nada.')
    if u.password and unquote(u.password) != '[YOUR-PASSWORD]':
        raise ValueError('Usá [YOUR-PASSWORD] en la URI, no la contraseña real.')
    return u


def main():
    print('Pegá la URI de Session pooler de Nora EBA, conservando [YOUR-PASSWORD]:')
    try:
        u = parse_staging_uri(input())
    except ValueError as error:
        raise SystemExit(str(error)) from None
    password = getpass.getpass('Contraseña de la base Nora EBA (staging): ')
    if not password or '\n' in password or '\r' in password:
        raise SystemExit('Contraseña vacía o inválida.')
    esc = lambda s: s.replace('\\','\\\\').replace(':','\\:')
    folder = pathlib.Path.home()/'.config'/'nora-staging'
    folder.mkdir(parents=True,exist_ok=True,mode=0o700)
    os.chmod(folder,0o700)
    fd, tmp = tempfile.mkstemp(prefix='conexion-',dir=folder)
    try:
        with os.fdopen(fd,'w') as f:
            f.write(':'.join(map(esc,[u.hostname,'5432','postgres',u.username,password]))+'\n')
        env = dict(os.environ,PGPASSFILE=tmp,PGSSLMODE='require',PGCONNECT_TIMEOUT='15')
        args=['/opt/homebrew/opt/postgresql@17/bin/psql','-X','-w','-h',u.hostname,'-p','5432','-U',u.username,'-d','postgres','-v','ON_ERROR_STOP=1','-At','-c',"select 'Conexion staging correcta'; select count(*) as tablas_publicas from pg_tables where schemaname='public';"]
        result = subprocess.run(args,env=env,capture_output=True,text=True)
        if result.returncode:
            print('No se pudo validar la conexión. No se guardó la contraseña. Revisá URI y contraseña de staging.')
            raise SystemExit(1)
        passfile=folder/'pgpass'
        os.replace(tmp,passfile)
        config=folder/'service.conf'
        fd=os.open(config,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
        with os.fdopen(fd,'w') as f:
            f.write(f'[nora_staging]\nhost={u.hostname}\nport=5432\nuser={u.username}\ndbname=postgres\nsslmode=require\npassfile={passfile}\nconnect_timeout=15\n')
        os.chmod(config,0o600)
        print(result.stdout.strip())
        print('Acceso guardado en ~/.config/nora-staging con permisos privados. No se modificó la base. Avisale a Codex: listo staging.')
    finally:
        if os.path.exists(tmp): os.unlink(tmp)


if __name__ == '__main__':
    main()
