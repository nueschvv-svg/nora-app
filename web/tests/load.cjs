const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Run the actual TypeScript modules; replace only external service boundaries.
exports.load = function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const resolver = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(path.relative(path.resolve(__dirname, '..'), target + '.ts'), mocks);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(resolver, module, module.exports);
  return module.exports;
};
