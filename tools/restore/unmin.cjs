const { runTransformationRules } = require('@wakaru/unminify');
const fs = require('fs'); const path=require('path');
const rules = ['un-curly-braces','un-sequence-expression','un-variable-merging','un-assignment-merging','un-boolean','un-undefined','un-infinity','un-typeof','un-numeric-literal','un-bracket-notation','un-return','un-while-loop','un-indirect-call','un-flip-comparisons','un-conditionals','un-sequence-expression','un-optional-chaining','un-nullish-coalescing','un-curly-braces','prettier'];
(async()=>{
for (const f of process.argv.slice(2)) {
  const src = fs.readFileSync(f,'utf8');
  try { const r = await runTransformationRules({ source: src, path: f }, rules); fs.writeFileSync(f, r.code ?? r); console.log('ok', path.basename(f)); }
  catch(e){ console.log('FAIL', f, e.message.slice(0,200)); }
}})();
