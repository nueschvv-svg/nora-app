import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('conexion',Path(__file__).with_name('conectar-staging.py'))
conexion=importlib.util.module_from_spec(spec)
spec.loader.exec_module(conexion)

class ConexionTests(unittest.TestCase):
    uri='postgresql://postgres.ccccntecmouklhdvbqjp:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'
    def test_placeholder_literal_y_codificado(self):
        for value in [self.uri,self.uri.replace('[YOUR-PASSWORD]','%5BYOUR-PASSWORD%5D')]:
            self.assertEqual(conexion.parse_staging_uri(value).username,'postgres.'+conexion.REF)
    def test_rechaza_produccion_y_conexion_invalida(self):
        for value in [self.uri.replace(conexion.REF,'copgcabmvndbgbxqvdjw'),self.uri.replace(':5432',':6543'),self.uri.replace(':5432',':invalid'),self.uri.replace('aws-0-sa-east-1.pooler.supabase.com','example.com'),'postgresql://[broken']:
            with self.subTest(uri=value),self.assertRaises(ValueError): conexion.parse_staging_uri(value)
    def test_no_expone_password_en_error(self):
        with self.assertRaises(ValueError) as error: conexion.parse_staging_uri(self.uri.replace('[YOUR-PASSWORD]','test-secret'))
        self.assertNotIn('test-secret',str(error.exception))

if __name__=='__main__': unittest.main()
