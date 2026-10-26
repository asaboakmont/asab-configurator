import fs from 'node:fs';
const source = new URL('../data/nativeCatalogue.json', import.meta.url);
const rows = JSON.parse(fs.readFileSync(source, 'utf8'));
fs.writeFileSync(new URL('../data/nativeCatalogueData.ts', import.meta.url), '// Generated from the validated FreeWop export. Prices include VAT; Smart uses approved Soho prices.\nexport default ' + JSON.stringify(rows, null, 2) + ';\n');
console.log(`Generated ${rows.length} native model records.`);
