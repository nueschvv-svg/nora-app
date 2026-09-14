const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const output = ['# Inventario de controles y rutas', '', 'Generado desde el código. Cada fila identifica un control, su acción declarada y su ubicación. No implica que se haya probado cada interacción: consultar INFORME.md para distinguir evidencia de navegador, tests y revisión estática.', ''];
let count = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!file.endsWith('.tsx')) continue;
    const text = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found = [];
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        const attributes = node.attributes.properties.map((p) => p.getText(source));
        if (['button', 'input', 'textarea', 'select', 'Link', 'a', 'form', 'CampoTexto', 'ControlFoto'].includes(tag) || attributes.includes('role="dialog"')) {
          const attrs = attributes.filter((a) => /^(href|onClick|onSubmit|onChange|type|id|aria-label|etiqueta|placeholder|disabled|role|abierto|value|name)/.test(a)).join('; ').replace(/\s+/g, ' ').slice(0, 300);
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          found.push(`| ${line} | ${tag} | ${attrs.replaceAll('|', '\\|')} | Declaración revisable; ejecución ver informe |`);
          count++;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    if (found.length) output.push(`## web/src/${path.relative(root, file)}`, '', '| Línea | Elemento | Acción / identificación | Evidencia |', '|---|---|---|---|', ...found, '');
  }
}
walk(root);
output.splice(4, 0, `Total: ${count} declaraciones de controles. Los controles dinámicos (categorías, fechas, filas) generan varias instancias desde una misma declaración.`, '');
fs.writeFileSync(path.resolve(__dirname, '../../docs/piloto/INVENTARIO.md'), output.join('\n'));
console.log(`${count} control declarations inventoried`);
