// Restores the greywall game source from the minified Vite bundle.
// usage: node restore.mjs <game.raw.js> <outDir>
import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _t from '@babel/traverse';
import _g from '@babel/generator';
import * as t from '@babel/types';
const traverse = _t.default?.default ?? _t.default ?? _t;
const generate = _g.default?.default ?? _g.default ?? _g;

const [, , SRC, OUT] = process.argv;
const code = fs.readFileSync(SRC, 'utf8');
const ast = parse(code, { sourceType: 'module' });

// original minified name -> [module, new name]
const M = {
  'core/iso.js': { u: 'tileToScreen', d: 'screenToTile', f: 'screenToTileRound', p: 'DIRECTIONS', m: 'DIR_VECTORS', h: 'dirFromStep', g: 'dirTowards', _: 'stepCost', v: 'NEIGHBORS8' },
  'core/pathfind.js': { y: 'findPath' },
  'core/rng.js': { D: 'createRng', O: 'randInt' },
  'data/items.js': { b: 'ITEMS' },
  'data/skills.js': { x: 'SKILLS' },
  'data/monsters.js': { S: 'MONSTERS' },
  'data/progression.js': { C: 'XP_TABLE' },
  'data/quests.js': { w: 'QUESTS' },
  'data/shops.js': { T: 'SHOPS' },
  'data/npcLines.js': { E: 'NPC_GREETINGS' },
  'sim/constants.js': { k: 'ACTION_TIMING', A: 'PLAYER_STEP', j: 'SWING_CANCEL_DELAY', M: 'DAY_LENGTH', N: 'ENCHANT_SAFE' },
  'sim/entities.js': { P: 'Entity', F: 'Monster', I: 'Npc', L: 'Player' },
  'sim/World.js': { R: 'World' },
  'sim/GameMap.js': { z: 'GameMap' },
  'maps/helpers.js': { B: 'BUILDING_SIZES', V: 'fillRect', H: 'fillBlob', U: 'paintPath', W: 'placeProp', G: 'placeBuilding', K: 'isOpenTile', q: 'randomizeVariants' },
  'maps/town.js': { ee: 'buildTown' },
  'maps/forest.js': { te: 'buildForest' },
  'maps/mine.js': { ne: 'buildMine' },
  'maps/orc.js': { re: 'buildOrcLands' },
  'maps/mine2.js': { ie: 'buildDeepMine' },
  'maps/index.js': { ae: 'MAP_BUILDERS' },
  'save.js': { J: 'fnv1a', Y: 'snapshotWorld', X: 'serializeSave', oe: 'parseSave', se: 'applySave', ce: 'saveKeys', le: 'writeSave' },
  'audio.js': { Z: 'audio' },
  'render/assets.js': { Ht: 'ASSETS', Ut: 'ANIMS', Wt: 'FX_DEFS', Gt: 'ICON_ATLAS' },
  'render/WorldScene.js': { Kt: 'GROUND_ROWS', qt: 'elevPx', Jt: 'WorldScene' },
  'pwa.js': { Yt: 'deferredPrompt', Xt: 'notifyPwa', Zt: 'pwa', Qt: 'initPwa' },
  'ui/dom.js': { Q: 'qs', $t: 'escapeHtml' },
  'ui/icons.js': { en: 'ICON_URLS', tn: 'loadIcons', nn: 'iconHtml' },
  'ui/UI.js': { rn: 'DEFAULT_QUICKSLOTS', an: 'SKILL_BOOKS', on: 'SKILL_SOURCES', sn: 'NPC_NAMES', cn: 'QUEST_STATE_LABELS', ln: 'UI' },
  'bot/Bot.js': { un: 'Bot', dn: 'createBotDriver' },
  'main.js': { fn: 'params', pn: 'DEV', mn: 'BOT', hn: 'botDriver', $: 'world', gn: 'scene', _n: 'game', vn: 'autosaveTimer', yn: 'ui', bn: 'lastDir', xn: 'pendingDir', Sn: 'pendingSince', Cn: 'debounceDir', wn: 'saveGame', Tn: 'continueLabel', En: 'showStartScreen', Dn: 'showRecovery', On: 'startGame', kn: 'bootGame', An: 'releaseAllInputs' },
};
// names whose declarations are dropped (asset urls, sprite data, glob maps) -> handled by render/assets.js
const DROP = new Set(['Rt', 'zt', 'Bt', 'Vt', 'Lt']);
const owner = {};
const rename = {};
for (const [mod, names] of Object.entries(M))
  for (const [o, n] of Object.entries(names)) { owner[o] = mod; rename[o] = n; }

// --- 1. collect sprite / fx data & decide drops
const data = { sprites: {}, fx: null };
const urlVar = {}; // var -> file basename
const globMaps = {}; // Rt/zt/Bt: key path -> var
const evalNode = (n) => new Function('return (' + code.slice(n.start, n.end) + ')')();
for (const st of ast.program.body) {
  if (st.type !== 'VariableDeclaration') continue;
  for (const d of st.declarations) {
    const nm = d.id.name;
    if (d.init?.type === 'MemberExpression' && code.slice(d.init.start, d.init.end).startsWith('new URL(')) {
      urlVar[nm] = d.init.object.arguments[0].quasis[0].value.cooked; DROP.add(nm);
    }
    if (['Rt', 'zt', 'Bt'].includes(nm)) {
      const obj = d.init.arguments[0];
      globMaps[nm] = Object.fromEntries(obj.properties.map((p) => [p.key.value, p.value.name]));
    }
    if (nm === 'Lt') data.fx = evalNode(d.init);
  }
}
for (const [file, v] of Object.entries(globMaps.zt)) { data.sprites[path.basename(file)] = v; DROP.add(v); }
// evaluate sprite json objects
const spriteJson = {};
for (const st of ast.program.body) if (st.type === 'VariableDeclaration') for (const d of st.declarations) {
  const f = Object.entries(data.sprites).find(([, v]) => v === d.id.name);
  if (f) spriteJson[f[0]] = evalNode(d.init);
}
const pngs = {};
for (const [file, v] of Object.entries({ ...globMaps.Rt, ...globMaps.Bt })) pngs[file.replace('../', '')] = urlVar[v];

// --- 2. rename top-level bindings
traverse(ast, {
  Program(p) {
    for (const [o, n] of Object.entries(rename)) {
      if (!p.scope.hasOwnBinding(o)) throw new Error('missing binding ' + o);
      p.scope.rename(o, n);
    }
    p.stop();
  },
});
// Phaser: l.default.X -> Phaser.X
traverse(ast, {
  MemberExpression(p) {
    const n = p.node;
    if (t.isIdentifier(n.object, { name: 'l' }) && t.isIdentifier(n.property, { name: 'default' }) && !p.scope.hasBinding('l'))
      p.replaceWith(t.identifier('Phaser'));
  },
});
// heuristic: constructor params assigned to this.<name> get that name
traverse(ast, {
  ClassMethod(p) {
    if (p.node.kind !== 'constructor') return;
    const params = p.node.params.map((x) => (t.isAssignmentPattern(x) ? x.left : x)).filter((x) => t.isIdentifier(x));
    for (const prm of params) {
      let target = null;
      p.traverse({
        AssignmentExpression(a) {
          const { left, right } = a.node;
          if (t.isMemberExpression(left) && t.isThisExpression(left.object) && t.isIdentifier(left.property) && t.isIdentifier(right, { name: prm.name }) && !target)
            target = left.property.name;
        },
      });
      if (target && !p.scope.hasBinding(target) && !/^(e|t|n|r|i|a|o|s|c|l|u|d)$/.test(target)) {
        try { p.scope.rename(prm.name, target); } catch {}
      }
    }
  },
});

// --- 3. assign statements to modules
const newOwner = {};
for (const [o, mod] of Object.entries(owner)) newOwner[rename[o]] = mod;
const stmtsByMod = {};
const declaredIn = {}; // name -> module
let lastMod = 'main.js';
const push = (mod, node) => (stmtsByMod[mod] ??= []).push(node);
for (const st of ast.program.body) {
  if (st.type === 'VariableDeclaration') {
    // split declarators by module
    for (const d of st.declarations) {
      const nm = d.id.name;
      if (DROP.has(nm)) continue;
      const mod = newOwner[nm];
      if (!mod) throw new Error('unassigned ' + nm);
      declaredIn[nm] = mod; lastMod = mod;
      push(mod, t.variableDeclaration(st.kind === 'var' ? 'let' : st.kind, [d]));
    }
  } else if (st.type === 'FunctionDeclaration') {
    const mod = newOwner[st.id.name];
    if (!mod) throw new Error('unassigned fn ' + st.id.name);
    declaredIn[st.id.name] = mod; lastMod = mod;
    push(mod, st);
  } else {
    // loose statements: the ones touching ITEMS go to items, asset loops dropped, rest to last module
    const src = generate(st).code;
    if (/Object\.entries\((Rt|zt|Bt)\)/.test(src)) continue;
    push(lastMod, st);
  }
}

// --- 4. imports/exports
const reassignedAnywhere = new Set();
traverse(ast, { AssignmentExpression(p) { const l = p.node.left; if (t.isIdentifier(l) && !p.scope.getBinding(l.name)?.scope.parent) reassignedAnywhere.add(l.name); },
  UpdateExpression(p) { const a = p.node.argument; if (t.isIdentifier(a)) reassignedAnywhere.add(a.name); } });
const allTop = new Set(Object.keys(declaredIn));
const files = {};
const reassigned = {};
for (const [mod, stmts] of Object.entries(stmtsByMod)) {
  const prog = t.program(stmts.map((s) => t.cloneNode(s, true)), [], 'module');
  const file = t.file(prog);
  const used = new Set();
  let usesPhaser = false;
  traverse(file, {
    Identifier(p) {
      const n = p.node.name;
      if (n === 'Phaser' && p.isReferencedIdentifier()) usesPhaser = true;
      if (!allTop.has(n) || declaredIn[n] === mod) return;
      if (p.isReferencedIdentifier() && !p.scope.hasBinding(n)) used.add(n);
      if (p.parentPath.isAssignmentExpression({ left: p.node }) && !p.scope.hasBinding(n)) (reassigned[n] ??= []).push(mod);
    },
  });
  const byMod = {};
  for (const n of used) (byMod[declaredIn[n]] ??= []).push(n);
  const rel = (to) => { let r = path.relative(path.dirname(mod), to); return r.startsWith('.') ? r : './' + r; };
  let head = '';
  if (usesPhaser) head += "import Phaser from 'phaser';\n";
  for (const [m, ns] of Object.entries(byMod).sort()) head += `import { ${ns.sort().join(', ')} } from '${rel(m)}';\n`;
  if (mod === 'render/assets.js') continue; // hand written
  // export every top-level name
  const own = Object.keys(declaredIn).filter((n) => declaredIn[n] === mod);
  // top-level `let X = class {}` -> `class X {}`; never-reassigned `let` -> `const`
  traverse(file, {
    Program(pp) {
      for (const sp of pp.get('body')) {
        if (!sp.isVariableDeclaration()) continue;
        const d = sp.node.declarations[0];
        const b = pp.scope.getBinding(d.id.name);
        const constant = b && b.constantViolations.length === 0 && !(reassignedAnywhere.has(d.id.name));
        if (t.isClassExpression(d.init) && constant) {
          sp.node.__cls = t.classDeclaration(t.identifier(d.id.name), d.init.superClass, d.init.body, d.init.decorators || []);
        } else if (constant && d.init) sp.node.kind = 'const';
      }
      pp.stop();
    },
  });
  prog.body = prog.body.map((n) => n.__cls ?? n);
  let body = generate(prog, { comments: false }).code;
  if (mod !== 'main.js') body += `\n\nexport { ${own.join(', ')} };\n`;
  files[mod] = head + '\n' + body;
}
if (Object.keys(reassigned).length) console.error('CROSS-MODULE REASSIGN', reassigned);

fs.mkdirSync(OUT, { recursive: true });
for (const [mod, src] of Object.entries(files)) {
  const f = path.join(OUT, 'src', mod);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, src);
}
// assets json
fs.mkdirSync(path.join(OUT, 'assets/sprites'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets/fx'), { recursive: true });
for (const [f, obj] of Object.entries(spriteJson)) fs.writeFileSync(path.join(OUT, 'assets/sprites', f), JSON.stringify(obj, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'assets/fx/fx.json'), JSON.stringify(data.fx, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'png-map.json'), JSON.stringify(pngs, null, 1));
console.log('modules', Object.keys(files).length, 'sprite json', Object.keys(spriteJson).length, 'pngs', Object.keys(pngs).length);
