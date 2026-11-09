const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

exports.load = function(file, names = [], globals = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  source = source.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export default /g, 'module.exports = ');
  const context = { module: { exports: {} }, console: { log() {}, error() {}, info() {} },
    setTimeout, clearTimeout, URL, ...globals };
  const result = vm.runInNewContext(source + '\n;({' + names.join(',') + '});', context, { filename: file });
  return names.length ? result : context.module.exports;
};
