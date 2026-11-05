/* ---------------------------------------------------------------
   Smart21 ElectroLab — Arduino sketch interpreter
   Runs a practical subset of Arduino C++ (setup/loop, variables,
   arrays, functions, if/for/while/switch, Serial, pinMode, digital/
   analog I/O, delay, millis, tone ...) on a *virtual clock*.
   Statements are generators so delay() can suspend the sketch while
   the circuit keeps simulating.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';

  class ArduinoError extends Error {
    constructor(msg, line) { super(msg); this.line = line || 0; this.name = 'ArduinoError'; }
  }

  const TYPE_WORDS = new Set(['void', 'int', 'long', 'short', 'byte', 'char', 'bool', 'boolean', 'float', 'double',
    'unsigned', 'signed', 'word', 'String', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'Servo', 'LiquidCrystal', 'Stepper', 'Keypad', 'LiquidCrystal_I2C', 'Adafruit_SSD1306', 'DHT']);
  const CLASS_TYPES = new Set(['Servo', 'LiquidCrystal', 'Stepper', 'Keypad', 'LiquidCrystal_I2C', 'Adafruit_SSD1306', 'DHT']);
  // classic 5×7 font (ASCII 32–126), 5 column bytes per character, bit 0 = top row
  const FONT5x7 = [[0,0,0,0,0],[0,0,0x5F,0,0],[0,7,0,7,0],[0x14,0x7F,0x14,0x7F,0x14],[0x24,0x2A,0x7F,0x2A,0x12],[0x23,0x13,8,0x64,0x62],[0x36,0x49,0x56,0x20,0x50],[0,8,7,3,0],[0,0x1C,0x22,0x41,0],[0,0x41,0x22,0x1C,0],[0x2A,0x1C,0x7F,0x1C,0x2A],[8,8,0x3E,8,8],[0,0x80,0x70,0x30,0],[8,8,8,8,8],[0,0,0x60,0x60,0],[0x20,0x10,8,4,2],
    [0x3E,0x51,0x49,0x45,0x3E],[0,0x42,0x7F,0x40,0],[0x72,0x49,0x49,0x49,0x46],[0x21,0x41,0x49,0x4D,0x33],[0x18,0x14,0x12,0x7F,0x10],[0x27,0x45,0x45,0x45,0x39],[0x3C,0x4A,0x49,0x49,0x31],[0x41,0x21,0x11,9,7],[0x36,0x49,0x49,0x49,0x36],[0x46,0x49,0x49,0x29,0x1E],[0,0,0x14,0,0],[0,0x40,0x34,0,0],[0,8,0x14,0x22,0x41],[0x14,0x14,0x14,0x14,0x14],[0,0x41,0x22,0x14,8],[2,1,0x59,9,6],
    [0x3E,0x41,0x5D,0x59,0x4E],[0x7C,0x12,0x11,0x12,0x7C],[0x7F,0x49,0x49,0x49,0x36],[0x3E,0x41,0x41,0x41,0x22],[0x7F,0x41,0x41,0x41,0x3E],[0x7F,0x49,0x49,0x49,0x41],[0x7F,9,9,9,1],[0x3E,0x41,0x41,0x51,0x73],[0x7F,8,8,8,0x7F],[0,0x41,0x7F,0x41,0],[0x20,0x40,0x41,0x3F,1],[0x7F,8,0x14,0x22,0x41],[0x7F,0x40,0x40,0x40,0x40],[0x7F,2,0x1C,2,0x7F],[0x7F,4,8,0x10,0x7F],[0x3E,0x41,0x41,0x41,0x3E],
    [0x7F,9,9,9,6],[0x3E,0x41,0x51,0x21,0x5E],[0x7F,9,0x19,0x29,0x46],[0x26,0x49,0x49,0x49,0x32],[3,1,0x7F,1,3],[0x3F,0x40,0x40,0x40,0x3F],[0x1F,0x20,0x40,0x20,0x1F],[0x3F,0x40,0x38,0x40,0x3F],[0x63,0x14,8,0x14,0x63],[3,4,0x78,4,3],[0x61,0x59,0x49,0x4D,0x43],[0,0x7F,0x41,0x41,0x41],[2,4,8,0x10,0x20],[0,0x41,0x41,0x41,0x7F],[4,2,1,2,4],[0x40,0x40,0x40,0x40,0x40],
    [0,3,7,8,0],[0x20,0x54,0x54,0x78,0x40],[0x7F,0x28,0x44,0x44,0x38],[0x38,0x44,0x44,0x44,0x28],[0x38,0x44,0x44,0x28,0x7F],[0x38,0x54,0x54,0x54,0x18],[0,8,0x7E,9,2],[0x18,0xA4,0xA4,0x9C,0x78],[0x7F,8,4,4,0x78],[0,0x44,0x7D,0x40,0],[0x20,0x40,0x40,0x3D,0],[0x7F,0x10,0x28,0x44,0],[0,0x41,0x7F,0x40,0],[0x7C,4,0x78,4,0x78],[0x7C,8,4,4,0x78],[0x38,0x44,0x44,0x44,0x38],
    [0xFC,0x18,0x24,0x24,0x18],[0x18,0x24,0x24,0x18,0xFC],[0x7C,8,4,4,8],[0x48,0x54,0x54,0x54,0x24],[4,4,0x3F,0x44,0x24],[0x3C,0x40,0x40,0x20,0x7C],[0x1C,0x20,0x40,0x20,0x1C],[0x3C,0x40,0x30,0x40,0x3C],[0x44,0x28,0x10,0x28,0x44],[0x4C,0x90,0x90,0x90,0x7C],[0x44,0x64,0x54,0x4C,0x44],[0,8,0x36,0x41,0],[0,0,0x77,0,0],[0,0x41,0x36,8,0],[2,1,2,4,2]];
  const QUALS = new Set(['const', 'static', 'volatile', 'extern', 'register']);
  const FLOAT_TYPES = new Set(['float', 'double']);
  const CONSTS = {
    HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13, true: 1, false: 0, NULL: 0,
    A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, PI: Math.PI, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2,
    DEC: 10, HEX: 16, BIN: 2, OCT: 8, LSBFIRST: 0, MSBFIRST: 1, RISING: 3, FALLING: 2, CHANGE: 1, NOT_AN_INTERRUPT: -1, EEPROM_SIZE: 1024, INT_MAX: 32767, INT_MIN: -32768, LONG_MAX: 2147483647, LONG_MIN: -2147483648, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI, EULER: Math.E,
    DHT11: 11, DHT21: 21, DHT22: 22, SSD1306_SWITCHCAPVCC: 2, SSD1306_EXTERNALVCC: 1, SSD1306_WHITE: 1, SSD1306_BLACK: 0, SSD1306_INVERSE: 2, WHITE: 1, BLACK: 0, INVERSE: 2,
    SS: 10, MOSI: 11, MISO: 12, SCK: 13, SDA: 18, SCL: 19,
    NOTE_C4: 262, NOTE_D4: 294, NOTE_E4: 330, NOTE_F4: 349, NOTE_G4: 392, NOTE_A4: 440, NOTE_B4: 494, NOTE_C5: 523
  };
  const FLOAT_FUNCS = new Set(['sqrt', 'pow', 'sin', 'cos', 'tan', 'atan', 'atan2', 'exp', 'log', 'float', 'double', 'fabs', 'asin', 'acos', 'sinh', 'cosh', 'tanh', 'log10', 'log2', 'cbrt', 'hypot', 'fmod', 'radians', 'degrees', 'fmin', 'fmax', 'trunc']);
  const PRECEDENCE = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
  const PUNCT3 = ['<<=', '>>='];
  const PUNCT2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '->', '::'];
  const STMT_COST = 0.004;              // virtual ms per executed statement (≈ 4 µs)
  const PAUSE = { pause: true };
  const BREAK = { k: 'break' }, CONT = { k: 'cont' };

  /* ============================ tokenizer ============================ */
  function tokenize(src, macros, depth) {
    macros = macros || {};
    const out = [];
    let i = 0, line = 1;
    const n = src.length;
    let lineStart = true;
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; lineStart = true; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
        i += 2; continue;
      }
      if (c === '#' && lineStart) {
        let j = i; let text = '';
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\' && src[j + 1] === '\n') { j += 2; line++; continue; }
          text += src[j++];
        }
        i = j;
        const m = /^#\s*define\s+([A-Za-z_]\w*)(\(?)\s*(.*)$/.exec(text.replace(/\/\/.*$/, ''));
        if (m) {
          if (m[2] === '(') throw new ArduinoError('Function-like #define macros are not supported by this emulator', line);
          macros[m[1]] = tokenize(m[3], {}, 1).map(t => Object.assign({}, t, { line }));
        }
        continue;
      }
      lineStart = false;
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i, isFloat = false, val;
        if (c === '0' && /[xX]/.test(src[i + 1] || '')) {
          j = i + 2; while (/[0-9a-fA-F]/.test(src[j] || '')) j++;
          val = parseInt(src.slice(i + 2, j), 16);
        } else if (c === '0' && /[bB]/.test(src[i + 1] || '')) {
          j = i + 2; while (/[01]/.test(src[j] || '')) j++;
          val = parseInt(src.slice(i + 2, j), 2);
        } else {
          while (/[0-9]/.test(src[j] || '')) j++;
          if (src[j] === '.') { isFloat = true; j++; while (/[0-9]/.test(src[j] || '')) j++; }
          if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) { isFloat = true; j += 2; while (/[0-9]/.test(src[j] || '')) j++; }
          val = parseFloat(src.slice(i, j));
        }
        while (/[uUlLfF]/.test(src[j] || '')) { if (/[fF]/.test(src[j]) && !(c === '0' && /[xX]/.test(src[i + 1] || ''))) isFloat = true; j++; }
        out.push({ t: 'num', v: val, float: isFloat, line }); i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i; while (/\w/.test(src[j] || '')) j++;
        const word = src.slice(i, j);
        if (/^B[01]{1,8}$/.test(word)) out.push({ t: 'num', v: parseInt(word.slice(1), 2), float: false, line });
        else out.push({ t: 'id', v: word, line });
        i = j; continue;
      }
      if (c === '"') {
        let j = i + 1, s = '';
        while (j < n && src[j] !== '"') {
          if (src[j] === '\n') throw new ArduinoError('Missing closing quote " in string', line);
          if (src[j] === '\\') { j++; s += ({ n: '\n', t: '\t', r: '\r', '0': '\0' })[src[j]] ?? src[j]; } else s += src[j];
          j++;
        }
        out.push({ t: 'str', v: s, line }); i = j + 1; continue;
      }
      if (c === "'") {
        let j = i + 1, ch;
        if (src[j] === '\\') { j++; ch = ({ n: '\n', t: '\t', r: '\r', '0': '\0' })[src[j]] ?? src[j]; } else ch = src[j];
        j++;
        if (src[j] !== "'") throw new ArduinoError("Character literal must be a single character like 'A'", line);
        out.push({ t: 'chr', v: ch.charCodeAt(0), line }); i = j + 1; continue;
      }
      const three = src.substr(i, 3), two = src.substr(i, 2);
      if (PUNCT3.includes(three)) { out.push({ t: 'op', v: three, line }); i += 3; continue; }
      if (PUNCT2.includes(two)) { out.push({ t: 'op', v: two, line }); i += 2; continue; }
      if ('+-*/%=<>!&|^~?:;,.(){}[]'.includes(c)) { out.push({ t: 'op', v: c, line }); i++; continue; }
      throw new ArduinoError("Unexpected character '" + c + "'", line);
    }
    // expand simple object-like macros
    if (!depth) {
      const expanded = [];
      const expand = (tok, d) => {
        if (tok.t === 'id' && macros[tok.v] && d < 8) macros[tok.v].forEach(m => expand(Object.assign({}, m, { line: tok.line }), d + 1));
        else expanded.push(tok);
      };
      out.forEach(t => expand(t, 0));
      return expanded;
    }
    return out;
  }

  /* ============================== parser ============================== */
  class Parser {
    constructor(tokens) { this.toks = tokens; this.p = 0; this.structs = new Map(); this.enumTypes = new Set(); this.aliases = new Map(); this.enumConsts = {}; this.anon = 0; }
    isTypeWord(v) { return TYPE_WORDS.has(v) || this.structs.has(v) || this.enumTypes.has(v) || this.aliases.has(v); }
    // 'struct Point p;' / 'enum Color c;' : the keyword is optional noise when the name is already known
    skipTagKeyword() {
      const t = this.cur, n = this.peek();
      if (t && t.t === 'id' && (t.v === 'struct' || t.v === 'enum') && n && n.t === 'id' && (this.structs.has(n.v) || this.enumTypes.has(n.v))) { const nn = this.peek(2); if (!(nn && nn.t === 'op' && nn.v === '{')) this.p++; }
    }
    constEval(n) {
      switch (n.type) {
        case 'num': case 'chr': return n.v;
        case 'id': if (Object.prototype.hasOwnProperty.call(this.enumConsts, n.name)) return this.enumConsts[n.name]; if (Object.prototype.hasOwnProperty.call(CONSTS, n.name)) return CONSTS[n.name]; break;
        case 'unary': { const v = this.constEval(n.arg); return n.op === '-' ? -v : n.op === '~' ? ~v : n.op === '!' ? (v ? 0 : 1) : v; }
        case 'bin': { const a = this.constEval(n.l), b = this.constEval(n.r);
          switch (n.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b ? Math.trunc(a / b) : 0; case '%': return b ? a % b : 0; case '<<': return a << b; case '>>': return a >> b; case '&': return a & b; case '|': return a | b; case '^': return a ^ b; } break; }
        case 'cond': return this.constEval(n.c) ? this.constEval(n.a) : this.constEval(n.b);
      }
      throw new ArduinoError('this value must be a number or a constant known at compile time (an enum value or a #define)', n.line);
    }
    // Parses "{ ... }" of a struct or enum (cursor on '{'); registers it and returns {vtype}.
    defineBody(kw, tag, line) {
      this.expectOp('{');
      if (kw === 'enum') {
        let next = 0;
        while (!this.isOp('}')) {
          if (!this.cur) throw new ArduinoError("expected '}' to close the enum that started on line " + line, line);
          const name = this.expectId(); let val = next;
          if (this.eatOp('=')) val = this.constEval(this.parseAssign());
          this.enumConsts[name] = val; next = val + 1;
          if (!this.eatOp(',')) break;
        }
        this.expectOp('}');
        if (tag) this.enumTypes.add(tag);
        return { vtype: 'int' };
      }
      if (!tag) tag = '__anon' + (++this.anon);
      const fields = [];
      while (!this.isOp('}')) {
        if (!this.cur) throw new ArduinoError("expected '}' to close the struct that started on line " + line, line);
        const fl = this.line(), ty = this.parseType();
        do {
          const name = this.expectId(), dims = [];
          while (this.eatOp('[')) { dims.push(this.constEval(this.parseExpr())); this.expectOp(']'); }
          if (fields.some(f => f.name === name)) throw new ArduinoError("duplicate member '" + name + "' in struct " + tag, fl);
          fields.push({ name, type: ty.type, dims });
        } while (this.eatOp(','));
        this.expectOp(';');
      }
      this.p++;
      this.structs.set(tag, { name: tag, fields });
      return { vtype: tag };
    }
    // struct / enum / typedef at global or statement level. Returns an array of declaration nodes, or null when it is only a use of a type.
    tryUserType() {
      const start = this.p, line = this.line(), kw = this.cur.v; this.p++;
      if (kw === 'typedef') {
        if (this.isId('struct') || this.isId('enum')) {
          const k2 = this.cur.v; this.p++;
          let tag2 = null; if (this.cur && this.cur.t === 'id') { tag2 = this.cur.v; this.p++; }
          if (this.isOp('{')) {                                      // typedef struct [Tag] { ... } Name;
            const d = this.defineBody(k2, tag2, line);
            const name = this.expectId(); this.expectOp(';');
            this.aliases.set(name, d.vtype); return [];
          }
          this.p = start + 1;                                       // typedef struct Tag Other;
        }
        const ty = this.parseType(); const name = this.expectId(); this.expectOp(';');
        this.aliases.set(name, ty.type); return [];
      }
      let tag = null;
      if (this.cur && this.cur.t === 'id') { tag = this.cur.v; this.p++; }
      if (!this.isOp('{')) { this.p = start; return null; }         // 'struct Point p;'  (a use, not a definition)
      const d = this.defineBody(kw, tag, line);
      if (this.cur && this.cur.t === 'id') return [this.parseDeclRest({ type: d.vtype, isConst: false, isStatic: false }, false)];
      this.expectOp(';');
      return [];
    }
    get cur() { return this.toks[this.p]; }
    peek(k = 1) { return this.toks[this.p + k]; }
    line() { const t = this.cur || this.toks[this.toks.length - 1]; return t ? t.line : 1; }
    isOp(v) { const t = this.cur; return t && t.t === 'op' && t.v === v; }
    isId(v) { const t = this.cur; return t && t.t === 'id' && t.v === v; }
    eatOp(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
    expectOp(v, hint) {
      if (!this.eatOp(v)) {
        const t = this.cur;
        const prev = this.toks[this.p - 1];
        const ln = (v === ';' && prev) ? prev.line : this.line();
        throw new ArduinoError("expected '" + v + "'" + (hint ? ' ' + hint : '') + (t ? " before '" + t.v + "'" : ' at end of file'), ln);
      }
    }
    expectId() {
      const t = this.cur;
      if (!t || t.t !== 'id') throw new ArduinoError('expected a name' + (t ? " but found '" + t.v + "'" : ''), this.line());
      this.p++; return t.v;
    }
    isTypeStart() {
      const t = this.cur;
      return t && t.t === 'id' && (this.isTypeWord(t.v) || QUALS.has(t.v) || ((t.v === 'struct' || t.v === 'enum') && this.peek() && this.structs.has(this.peek().v) || this.enumTypes.has(this.peek() ? this.peek().v : '')));
    }
    parseType() {
      const q = { isConst: false, isStatic: false };
      while (this.cur && this.cur.t === 'id' && QUALS.has(this.cur.v)) { if (this.cur.v === 'const') q.isConst = true; if (this.cur.v === 'static') q.isStatic = true; this.p++; }
      this.skipTagKeyword();
      const words = [];
      while (this.cur && this.cur.t === 'id' && this.isTypeWord(this.cur.v)) { words.push(this.cur.v); this.p++; if (words[0] !== 'unsigned' && words[0] !== 'signed' && words[0] !== 'long') break; if (words.length >= 3) break; }
      while (this.cur && this.cur.t === 'id' && QUALS.has(this.cur.v)) this.p++;
      if (!words.length) throw new ArduinoError('expected a type like int, float or void', this.line());
      let type = words.join(' ').replace(/^signed /, '');
      if (this.aliases.has(type)) type = this.aliases.get(type);
      if (this.enumTypes.has(type)) type = 'int';
      if (type === 'unsigned') type = 'unsigned int';
      if (type === 'long int') type = 'long';
      if (type === 'unsigned long int' || type === 'unsigned long long') type = 'unsigned long';
      if (type === 'long long') type = 'long';
      if (this.isOp('*')) { this.p++; if (type === 'char') type = 'String'; else throw new ArduinoError('Pointers are not supported by this emulator', this.line()); }
      let isRef = false; if (this.isOp('&')) { this.p++; isRef = true; }
      return Object.assign({ type, isRef }, q);
    }

    parseProgram() {
      const globals = [], funcs = new Map();
      while (this.cur) {
        if (this.isId('struct') || this.isId('typedef') || this.isId('enum')) {
          const r = this.tryUserType();
          if (r) { globals.push(...r); continue; }
        }
        if (this.isId('class') || this.isId('template'))
          throw new ArduinoError("'" + this.cur.v + "' is not supported by this emulator yet", this.line());
        if (!this.isTypeStart()) throw new ArduinoError("unexpected '" + this.cur.v + "' outside a function", this.line());
        const line = this.line();
        const ty = this.parseType();
        const name = this.expectId();
        if (this.isOp('(') && !CLASS_TYPES.has(ty.type)) {
          this.p++;
          const params = [];
          if (!this.isOp(')')) {
            if (this.isId('void') && this.peek().t === 'op' && this.peek().v === ')') this.p++;
            else do {
              const pt = this.parseType(); const pn = this.expectId(); let isArr = false;
              while (this.eatOp('[')) { this.expectOp(']'); isArr = true; }
              params.push({ type: pt.type, name: pn, isArr, isRef: pt.isRef });
            } while (this.eatOp(','));
          }
          this.expectOp(')');
          const body = this.parseBlock();
          if (funcs.has(name)) throw new ArduinoError("redefinition of function '" + name + "'", line);
          funcs.set(name, { name, rtype: ty.type, params, body, line });
        } else {
          this.p--;
          globals.push(this.parseDeclRest(ty, true));
        }
      }
      return { globals, funcs, structs: this.structs, enumConsts: this.enumConsts };
    }

    // after the type: parse "name [dims] [= init] {, name2 ...} ;"
    parseDeclRest(ty, isGlobal) {
      const line = this.line();
      const decls = [];
      do {
        const name = this.expectId();
        const dims = [];
        let isArray = false;
        while (this.eatOp('[')) { isArray = true; dims.push(this.isOp(']') ? null : this.parseExpr()); this.expectOp(']'); }
        let init = null;
        if (this.eatOp('=')) {
          if (!isArray && CLASS_TYPES.has(ty.type) && this.isId(ty.type) && this.peek() && this.peek().t === 'op' && this.peek().v === '(') { this.p++; init = { type: 'ctor', args: this.parseArgs(), line }; }   // Keypad k = Keypad(...);
          else init = this.isOp('{') ? this.parseArrInit() : this.parseAssign();
        }
        else if (this.isOp('(') && !isArray && CLASS_TYPES.has(ty.type)) { init = { type: 'ctor', args: this.parseArgs(), line }; }
        else if (this.isOp('(') && !isArray) { this.p++; init = this.isOp(')') ? null : this.parseAssign(); this.expectOp(')'); }
        decls.push({ type: 'decl', vtype: ty.type, name, isArray, dims, init, isStatic: ty.isStatic, isConst: ty.isConst, line });
      } while (this.eatOp(','));
      this.expectOp(';');
      return decls.length === 1 ? decls[0] : { type: 'decls', list: decls, line };
    }
    parseArrInit() {
      const line = this.line(); this.expectOp('{');
      const items = [];
      if (!this.isOp('}')) do { if (this.isOp('}')) break; items.push(this.isOp('{') ? this.parseArrInit() : this.parseAssign()); } while (this.eatOp(','));
      this.expectOp('}');
      return { type: 'arrinit', items, line };
    }

    parseBlock() {
      const line = this.line();
      this.expectOp('{');
      const body = [];
      while (!this.isOp('}')) {
        if (!this.cur) throw new ArduinoError("expected '}' to close the block that started on line " + line, this.toks[this.toks.length - 1].line);
        body.push(this.parseStmt());
      }
      this.p++;
      return { type: 'block', body, line };
    }

    parseStmt() {
      const t = this.cur, line = t.line;
      if (t.t === 'op') {
        if (t.v === '{') return this.parseBlock();
        if (t.v === ';') { this.p++; return { type: 'empty', line }; }
      }
      if (t.t === 'id') {
        switch (t.v) {
          case 'if': {
            this.p++; this.expectOp('('); const cond = this.parseExpr(); this.expectOp(')');
            const then = this.parseStmt(); let els = null;
            if (this.isId('else')) { this.p++; els = this.parseStmt(); }
            return { type: 'if', cond, then, els, line };
          }
          case 'while': { this.p++; this.expectOp('('); const cond = this.parseExpr(); this.expectOp(')'); return { type: 'while', cond, body: this.parseStmt(), line }; }
          case 'do': {
            this.p++; const body = this.parseStmt();
            if (!this.isId('while')) throw new ArduinoError("expected 'while' after do-block", this.line());
            this.p++; this.expectOp('('); const cond = this.parseExpr(); this.expectOp(')'); this.expectOp(';');
            return { type: 'do', cond, body, line };
          }
          case 'for': {
            this.p++; this.expectOp('(');
            let init = null, cond = null, step = null;
            if (!this.isOp(';')) {
              if (this.isTypeStart()) { const ty = this.parseType(); init = this.parseDeclRest(ty); }
              else { init = { type: 'expr', expr: this.parseExpr(), line }; this.expectOp(';'); }
            } else this.p++;
            if (!this.isOp(';')) cond = this.parseExpr();
            this.expectOp(';');
            if (!this.isOp(')')) step = this.parseExpr();
            this.expectOp(')');
            return { type: 'for', init, cond, step, body: this.parseStmt(), line };
          }
          case 'switch': {
            this.p++; this.expectOp('('); const expr = this.parseExpr(); this.expectOp(')'); this.expectOp('{');
            const cases = [];
            while (!this.isOp('}')) {
              if (!this.cur) throw new ArduinoError("expected '}' at end of switch", line);
              let c;
              if (this.isId('case')) { this.p++; c = { test: this.parseTernary(), body: [], line: this.line() }; this.expectOp(':'); }
              else if (this.isId('default')) { this.p++; this.expectOp(':'); c = { test: null, body: [], line: this.line() }; }
              else throw new ArduinoError("expected 'case' or 'default' inside switch", this.line());
              while (!this.isOp('}') && !this.isId('case') && !this.isId('default')) c.body.push(this.parseStmt());
              cases.push(c);
            }
            this.p++;
            return { type: 'switch', expr, cases, line };
          }
          case 'return': { this.p++; let expr = null; if (!this.isOp(';')) expr = this.parseExpr(); this.expectOp(';'); return { type: 'return', expr, line }; }
          case 'break': this.p++; this.expectOp(';'); return { type: 'break', line };
          case 'continue': this.p++; this.expectOp(';'); return { type: 'continue', line };
          case 'struct': case 'enum': case 'typedef': {
            const r = this.tryUserType();
            if (r) return r.length === 1 ? r[0] : { type: 'decls', list: r, line };
            break;
          }
          case 'class': throw new ArduinoError("'class' is not supported by this emulator yet (use struct)", line);
        }
        if (this.isTypeStart() && !(this.peek() && this.peek().t === 'op' && (this.peek().v === '(' || this.peek().v === '.'))) {
          const ty = this.parseType();
          return this.parseDeclRest(ty);
        }
      }
      const expr = this.parseExpr();
      this.expectOp(';');
      return { type: 'expr', expr, line };
    }

    /* ---- expressions ---- */
    parseExpr() {
      let e = this.parseAssign();
      while (this.isOp(',') && false) { this.p++; e = this.parseAssign(); }
      return e;
    }
    parseAssign() {
      const left = this.parseTernary();
      const t = this.cur;
      if (t && t.t === 'op' && ASSIGN_OPS.has(t.v)) {
        if (left.type !== 'id' && left.type !== 'index' && left.type !== 'member') throw new ArduinoError('left side of ' + t.v + ' must be a variable', t.line);
        this.p++;
        const value = this.parseAssign();
        return { type: 'assign', op: t.v, target: left, value, line: t.line };
      }
      return left;
    }
    parseTernary() {
      const c = this.parseBinary(1);
      if (this.isOp('?')) {
        const line = this.line(); this.p++;
        const a = this.parseAssign(); this.expectOp(':'); const b = this.parseAssign();
        return { type: 'cond', c, a, b, line };
      }
      return c;
    }
    parseBinary(minPrec) {
      let left = this.parseUnary();
      for (;;) {
        const t = this.cur;
        if (!t || t.t !== 'op') break;
        const prec = PRECEDENCE[t.v];
        if (!prec || prec < minPrec) break;
        this.p++;
        const right = this.parseBinary(prec + 1);
        left = { type: 'bin', op: t.v, l: left, r: right, line: t.line };
      }
      return left;
    }
    parseUnary() {
      const t = this.cur;
      if (!t) throw new ArduinoError('unexpected end of file in expression', this.line());
      if (t.t === 'op') {
        if (t.v === '!' || t.v === '-' || t.v === '+' || t.v === '~' || t.v === '&') { this.p++; return { type: 'unary', op: t.v, arg: this.parseUnary(), line: t.line }; }
        if (t.v === '++' || t.v === '--') { this.p++; const arg = this.parseUnary(); return { type: 'incdec', op: t.v, prefix: true, arg, line: t.line }; }
        if (t.v === '(' && this.peek() && this.peek().t === 'id' && this.isTypeWord(this.peek().v)) {
          const save = this.p; this.p++;
          const ty = this.parseType();
          if (this.eatOp(')')) return { type: 'cast', ctype: ty.type, arg: this.parseUnary(), line: t.line };
          this.p = save;
        }
      }
      return this.parsePostfix();
    }
    parsePostfix() {
      let e = this.parsePrimary();
      for (;;) {
        const t = this.cur;
        if (!t || t.t !== 'op') break;
        if (t.v === '[') { this.p++; const idx = this.parseExpr(); this.expectOp(']'); e = { type: 'index', base: e, idx, line: t.line }; }
        else if (t.v === '++' || t.v === '--') { this.p++; e = { type: 'incdec', op: t.v, prefix: false, arg: e, line: t.line }; }
        else if (t.v === '.') {
          this.p++; const name = this.expectId();
          if (this.isOp('(')) { const args = this.parseArgs(); e = { type: 'method', obj: e, name, args, line: t.line }; }
          else e = { type: 'member', obj: e, name, line: t.line };
        } else break;
      }
      return e;
    }
    parseArgs() {
      this.expectOp('(');
      const args = [];
      if (!this.isOp(')')) do { args.push(this.parseAssign()); } while (this.eatOp(','));
      this.expectOp(')');
      return args;
    }
    parsePrimary() {
      const t = this.cur;
      if (!t) throw new ArduinoError('unexpected end of file', this.line());
      this.p++;
      if (t.t === 'num') return { type: 'num', v: t.v, float: t.float, line: t.line };
      if (t.t === 'chr') return { type: 'chr', v: t.v, line: t.line };
      if (t.t === 'str') return { type: 'str', v: t.v, line: t.line };
      if (t.t === 'id') {
        if (t.v === 'sizeof') {
          this.expectOp('(');
          let node;
          if (this.isTypeStart()) { const ty = this.parseType(); node = { type: 'sizeofT', ctype: ty.type, line: t.line }; }
          else node = { type: 'sizeofE', arg: this.parseExpr(), line: t.line };
          this.expectOp(')'); return node;
        }
        if (this.isOp('(')) {
          const args = this.parseArgs();
          return { type: 'call', name: t.v, args, line: t.line };
        }
        if (this.isTypeWord(t.v) && this.isOp('(')) return null;
        return { type: 'id', name: t.v, line: t.line };
      }
      if (t.t === 'op' && t.v === '(') { const e = this.parseExpr(); this.expectOp(')'); return e; }
      throw new ArduinoError("unexpected '" + t.v + "'", t.line);
    }
  }

  /* ============================ interpreter ============================ */
  class Scope {
    constructor(parent) { this.vars = new Map(); this.parent = parent || null; }
    lookup(name) { for (let s = this; s; s = s.parent) { const v = s.vars.get(name); if (v) return v; } return null; }
  }

  const isStruct = v => !!v && typeof v === 'object' && !Array.isArray(v) && v.__struct !== undefined;
  const cloneVal = v => Array.isArray(v) ? v.map(cloneVal) : (isStruct(v) ? { __struct: v.__struct, f: Object.fromEntries(Object.entries(v.f).map(([k, x]) => [k, cloneVal(x)])) } : v);
  function typeSize(t) {
    if (t === 'byte' || t === 'char' || t === 'bool' || t === 'boolean' || t === 'uint8_t' || t === 'int8_t') return 1;
    if (t === 'long' || t === 'unsigned long' || t === 'float' || t === 'double' || t === 'uint32_t' || t === 'int32_t') return 4;
    return 2;
  }
  function coerce(type, v) {
    if (type === 'String') return typeof v === 'string' ? v : String(v);
    if (typeof v === 'string') return v;
    if (Number.isNaN(v) && (type === 'float' || type === 'double')) return NaN;       // a failed sensor read stays NaN so isnan() works
    if (v === undefined || v === null || Number.isNaN(v)) v = 0;
    switch (type) {
      case 'float': case 'double': return Math.fround(v);
      case 'int': case 'short': case 'int16_t': return (Math.trunc(v) << 16) >> 16;
      case 'long': case 'int32_t': case 'int64_t': return Math.trunc(v) | 0;
      case 'unsigned long': case 'uint32_t': case 'size_t': case 'uint64_t': return Math.trunc(v) >>> 0;
      case 'unsigned int': case 'word': case 'uint16_t': return Math.trunc(v) & 0xFFFF;
      case 'byte': case 'uint8_t': case 'unsigned char': return Math.trunc(v) & 0xFF;
      case 'char': case 'int8_t': return (Math.trunc(v) << 24) >> 24;
      case 'bool': case 'boolean': return v ? 1 : 0;
      default: return v;
    }
  }
  function truthy(v) { return typeof v === 'string' ? v.length > 0 : !!v; }
  function fmtFloat(v, digits) {
    if (!isFinite(v)) return Number.isNaN(v) ? 'nan' : (v > 0 ? 'inf' : '-inf');
    return v.toFixed(digits);
  }

  class Interpreter {
    constructor(program) {
      this.prog = program;
      this.funcs = program.funcs;
      this.globals = new Scope(null);
      this.now = 0; this.limit = 0; this.wake = null;
      this.ops = 0; this.depth = 0;
      this.events = [];
      this.pinMode = new Array(20).fill(0);
      this.pinOut = new Array(20).fill(0);
      this.pinVolts = new Float64Array(20);
      this.pinRead = new Array(20).fill(0);
      this.serialBegan = false; this.warned = {};
      this.onSerial = () => {}; this.onWarn = () => {};
      this.serialIn = [];
      this.finished = false; this.error = null;
      this.loopCount = 0;
      this.libObjects = [];
      this.pinRise = new Array(20).fill(undefined); this.pinPulse = new Array(20).fill(null);
      this.oracle = null;                       // set by the runtime: answers pulseIn() from simulated sensors
      this.rng = 123456789;
      this.structs = program.structs || new Map(); this.enumConsts = program.enumConsts || {};
      this.eeprom = new Uint8Array(1024).fill(255);     // the runtime swaps in its persistent array
      this.isrs = [null, null]; this.isrPend = [false, false]; this.isrTime = [0, 0]; this.isrAny = false; this.inIsr = false; this.intEnabled = true;
      this.gen = this.main();
    }

    warnOnce(key, msg, line) { if (!this.warned[key]) { this.warned[key] = 1; this.onWarn(msg, line); } }
    random01() { let x = this.rng; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.rng = x || 1; return this.rng / 4294967296; }
    emit(kind, pin, val, extra) { this.events.push(Object.assign({ t: this.now, kind, pin, val }, extra || {})); }

    // Advance the sketch until virtual time `limit`. Returns the time actually reached.
    runUntil(limit, maxOps) {
      if (this.finished || this.error) return limit;
      this.limit = limit;
      const opsStart = this.ops;
      try {
        for (;;) {
          if (this.isrAny) this.serviceIsrs();
          if (this.wake !== null) {
            if (this.wake > limit) return limit;
            this.now = this.wake; this.wake = null;
          }
          if (this.now >= limit) return limit;
          if (this.ops - opsStart > maxOps) return Math.min(limit, this.now);
          const r = this.gen.next();
          if (r.done) { this.finished = true; return limit; }
          if (r.value && r.value.wait !== undefined) this.wake = this.now + r.value.wait;
        }
      } catch (e) {
        if (e instanceof ArduinoError) { this.error = e; return limit; }
        throw e;
      }
    }

    raiseInterrupt(k) {
      if (!this.isrs[k] || this.isrPend[k]) return;
      this.isrPend[k] = true; this.isrTime[k] = this.limit; this.isrAny = true;
    }
    serviceIsrs() {
      if (!this.intEnabled || this.inIsr) return;
      for (let k = 0; k < 2; k++) {
        if (!this.isrPend[k] || !this.isrs[k]) { this.isrPend[k] = false; continue; }
        this.isrPend[k] = false;
        const save = this.now, depth = this.depth, sleeping = this.wake !== null;
        if (sleeping) this.now = Math.max(save, this.isrTime[k] - 1);
        this.inIsr = true;
        try { this.driveSync(this.callUser(this.isrs[k].fn, [], 0)); }
        finally { this.inIsr = false; this.depth = depth; }
        if (sleeping) this.now = save;
      }
      this.isrAny = this.isrPend[0] || this.isrPend[1];
    }

    *main() {
      for (const g of this.prog.globals) yield* this.exec(g, this.globals);
      const setup = this.funcs.get('setup'), loop = this.funcs.get('loop');
      if (setup) yield* this.callUser(setup, [], 0);
      for (;;) {
        if (loop) yield* this.callUser(loop, [], 0);
        this.loopCount++;
        this.now += STMT_COST;
        if (this.now >= this.limit) yield PAUSE;
      }
    }

    *callUser(fn, args, line) {
      if (args.length !== fn.params.length) throw new ArduinoError("function '" + fn.name + "' expects " + fn.params.length + ' argument(s) but got ' + args.length, line);
      if (++this.depth > 120) throw new ArduinoError('Stack overflow: function calls itself too deeply (' + fn.name + ')', line);
      const scope = new Scope(this.globals);
      fn.params.forEach((p, i) => scope.vars.set(p.name, { type: p.type, val: p.isArr ? args[i] : (isStruct(args[i]) ? (p.isRef ? args[i] : cloneVal(args[i])) : coerce(p.type, args[i])), arr: p.isArr }));
      const r = yield* this.exec(fn.body, scope);
      this.depth--;
      if (r && r.k === 'ret') return fn.rtype === 'void' ? 0 : coerce(fn.rtype, r.v);
      return 0;
    }
    driveSync(gen) {
      let guard = 0;
      for (;;) {
        const r = gen.next();
        if (r.done) return r.value;
        if (r.value && r.value.wait !== undefined) { if (this.inIsr) this.warnOnce('isrdelay', 'delay() inside an interrupt handler does nothing on a real Arduino. Keep handlers short and set a flag instead.', 0); else this.now += r.value.wait; }
        if (++guard > 2e6) throw new ArduinoError('The sketch seems stuck inside a function call', 0);
      }
    }

    // statement-level evaluation that may suspend on delay()
    *evalG(node, scope) {
      if (node.type === 'call') {
        if (node.name === 'delay' || node.name === 'delayMicroseconds') {
          let ms = this.evalExpr(node.args[0], scope);
          if (node.name === 'delayMicroseconds') ms /= 1000;
          yield { wait: Math.max(0, ms) };
          return 0;
        }
        const fn = this.funcs.get(node.name);
        if (fn) return yield* this.callUser(fn, node.args.map(a => this.evalExpr(a, scope)), node.line);
      }
      return this.evalExpr(node, scope);
    }

    *exec(node, scope) {
      if (this.isrAny && !this.inIsr) this.serviceIsrs();
      this.now += STMT_COST; this.ops++;
      if (this.now >= this.limit) yield PAUSE;
      switch (node.type) {
        case 'block': {
          const s = new Scope(scope);
          for (const st of node.body) { const r = yield* this.exec(st, s); if (r) return r; }
          return undefined;
        }
        case 'decls': for (const d of node.list) yield* this.exec(d, scope); return undefined;
        case 'decl': return yield* this.execDecl(node, scope);
        case 'expr': yield* this.evalG(node.expr, scope); return undefined;
        case 'empty': return undefined;
        case 'if':
          if (truthy(yield* this.evalG(node.cond, scope))) return yield* this.exec(node.then, scope);
          if (node.els) return yield* this.exec(node.els, scope);
          return undefined;
        case 'while':
          while (truthy(yield* this.evalG(node.cond, scope))) {
            const r = yield* this.exec(node.body, scope);
            if (r) { if (r === BREAK) break; if (r === CONT) continue; return r; }
          }
          return undefined;
        case 'do':
          do {
            const r = yield* this.exec(node.body, scope);
            if (r) { if (r === BREAK) break; if (r === CONT) continue; return r; }
          } while (truthy(yield* this.evalG(node.cond, scope)));
          return undefined;
        case 'for': {
          const s = new Scope(scope);
          if (node.init) yield* this.exec(node.init, s);
          while (!node.cond || truthy(yield* this.evalG(node.cond, s))) {
            const r = yield* this.exec(node.body, s);
            if (r) { if (r === BREAK) break; if (r !== CONT) return r; }
            if (node.step) yield* this.evalG(node.step, s);
          }
          return undefined;
        }
        case 'switch': {
          const val = this.evalExpr(node.expr, scope);
          let start = -1;
          for (let i = 0; i < node.cases.length; i++) if (node.cases[i].test && this.evalExpr(node.cases[i].test, scope) === val) { start = i; break; }
          if (start < 0) start = node.cases.findIndex(c => !c.test);
          if (start < 0) return undefined;
          const s = new Scope(scope);
          for (let i = start; i < node.cases.length; i++)
            for (const st of node.cases[i].body) { const r = yield* this.exec(st, s); if (r) return r === BREAK ? undefined : r; }
          return undefined;
        }
        case 'return': return { k: 'ret', v: node.expr ? yield* this.evalG(node.expr, scope) : 0 };
        case 'break': return BREAK;
        case 'continue': return CONT;
      }
      throw new ArduinoError('cannot run statement of type ' + node.type, node.line);
    }

    makeObject(type, args, line) {
      let o;
      if (type === 'Servo') o = { __lib: 'Servo', pin: -1, angle: 90, attached: false };
      else if (type === 'Stepper') {
        if (args.length !== 3 && args.length !== 5) throw new ArduinoError('Stepper needs Stepper(stepsPerRevolution, pin1, pin2) or Stepper(stepsPerRevolution, pin1, pin2, pin3, pin4)', line);
        const pins = args.slice(1).map(a => Math.trunc(a)); o = { __lib: 'Stepper', steps: Math.max(1, Math.trunc(args[0])), pins, stepNo: 0, delay: 60000 / (Math.max(1, Math.trunc(args[0])) * 10), speedSet: false };
        for (const p of pins) { if (p >= 0 && p < 20) { this.pinMode[p] = 1; this.emit('mode', p, 1); } }
      } else if (type === 'LiquidCrystal_I2C') {
        if (args.length < 3) throw new ArduinoError('LiquidCrystal_I2C needs LiquidCrystal_I2C lcd(address, columns, rows); for example (0x27, 16, 2)', line);
        const cols = Math.trunc(args[1]) || 16, rows = Math.trunc(args[2]) || 2;
        o = { __lib: 'LCD', i2c: true, addr: Math.trunc(args[0]), cols, rows, col: 0, row: 0, inited: false, display: true, backlight: false, lines: Array.from({ length: rows }, () => ' '.repeat(cols)) };
      } else if (type === 'Adafruit_SSD1306') {
        if (args.length < 2) throw new ArduinoError('Adafruit_SSD1306 needs Adafruit_SSD1306 display(128, 64, &Wire, -1);', line);
        const w = Math.trunc(args[0]) || 128, h = Math.trunc(args[1]) || 64;
        o = { __lib: 'OLED', w, h, buf: new Uint8Array(w * h), shown: new Uint8Array(w * h), ver: 0, cx: 0, cy: 0, size: 1, color: 1, wrap: true, inited: false, invert: false, addr: 0x3C };
      } else if (type === 'DHT') {
        if (args.length < 1) throw new ArduinoError('DHT needs DHT dht(pin, DHT11); (or DHT22)', line);
        o = { __lib: 'DHT', pin: Math.trunc(args[0]), model: args[1] === undefined ? 11 : Math.trunc(args[1]), began: false };
      } else if (type === 'Keypad') {
        if (args.length !== 5) throw new ArduinoError('Keypad needs Keypad(makeKeymap(keys), rowPins, colPins, rows, cols)', line);
        o = { __lib: 'Keypad', keymap: args[0], rowPins: args[1], colPins: args[2], rows: Math.trunc(args[3]), cols: Math.trunc(args[4]), last: 0 };
        for (const p of o.rowPins) { this.pinMode[p] = 2; this.emit('mode', p, 2); }
      } else {
        if (args.length !== 6) throw new ArduinoError('LiquidCrystal needs 6 pins here: LiquidCrystal lcd(rs, enable, d4, d5, d6, d7); (4-bit mode)', line);
        const [rs, en, d4, d5, d6, d7] = args.map(a => Math.trunc(a));
        o = { __lib: 'LCD', pins: { rs, en, d4, d5, d6, d7 }, cols: 16, rows: 2, col: 0, row: 0, inited: false, display: true, lines: [' '.repeat(16), ' '.repeat(16)] };
      }
      this.libObjects.push(o); return o;
    }

    // Builds a (possibly array of) struct / scalar value from dims + an optional { } initialiser.
    buildValue(type, dims, level, init, scope, line) {
      if (level < dims.length) {
        let len = dims[level];
        if (len === null) len = init && init.type === 'arrinit' ? init.items.length : 0;
        const arr = new Array(len);
        for (let i = 0; i < len; i++) arr[i] = this.buildValue(type, dims, level + 1, init && init.type === 'arrinit' ? init.items[i] || null : null, scope, line);
        return arr;
      }
      const def = this.structs.get(type);
      if (!def) { if (init && init.type !== 'arrinit') return coerce(type, this.evalExpr(init, scope)); return type === 'String' ? '' : 0; }
      if (init && init.type !== 'arrinit') { const v = this.evalExpr(init, scope); if (!isStruct(v) || v.__struct !== type) throw new ArduinoError("cannot initialise a '" + type + "' from that value", line); return cloneVal(v); }
      if (init && init.items.length > def.fields.length) throw new ArduinoError("too many values in the { } list for struct '" + type + "' (it has " + def.fields.length + ' members)', line);
      const f = {};
      def.fields.forEach((fd, i) => { f[fd.name] = this.buildValue(fd.type, fd.dims, 0, init && init.items[i] ? init.items[i] : null, scope, line); });
      return { __struct: type, f };
    }
    sizeOfType(t) {
      const d = this.structs.get(t);
      if (!d) return typeSize(t);
      return d.fields.reduce((a, f) => a + this.sizeOfType(f.type) * f.dims.reduce((x, y) => x * y, 1), 0);
    }
    fieldOf(o, name, line) {
      if (!isStruct(o)) throw new ArduinoError("request for member '" + name + "' in something that is not a struct", line);
      const d = this.structs.get(o.__struct), fd = d && d.fields.find(f => f.name === name);
      if (!fd) throw new ArduinoError("'" + o.__struct + "' has no member named '" + name + "'", line);
      return fd;
    }

    *execDecl(node, scope) {
      if (node.isStatic && node.cell) { scope.vars.set(node.name, node.cell); return undefined; }
      let cell;
      if (CLASS_TYPES.has(node.vtype)) {
        if (node.isArray) {
          const n = node.dims[0] ? this.evalExpr(node.dims[0], scope) : 0;
          cell = { type: node.vtype, val: Array.from({ length: n }, () => this.makeObject(node.vtype, [], node.line)), arr: true };
        } else {
          const args = node.init && node.init.type === 'ctor' ? node.init.args.map(a => this.evalExpr(a, scope)) : [];
          cell = { type: node.vtype, val: this.makeObject(node.vtype, args, node.line), arr: false };
        }
        if (node.isStatic) node.cell = cell;
        scope.vars.set(node.name, cell); return undefined;
      }
      if (this.structs.has(node.vtype)) {
        const dims = node.dims.map(d => d ? this.evalExpr(d, scope) : null);
        if (node.isArray) cell = { type: node.vtype, val: this.buildValue(node.vtype, dims, 0, node.init, scope, node.line), arr: true };
        else {
          let val;
          if (node.init && node.init.type !== 'arrinit') {
            val = yield* this.evalG(node.init, scope);
            if (!isStruct(val) || val.__struct !== node.vtype) throw new ArduinoError("cannot initialise a '" + node.vtype + "' from that value", node.line);
            val = cloneVal(val);
          } else val = this.buildValue(node.vtype, [], 0, node.init, scope, node.line);
          cell = { type: node.vtype, val, arr: false };
        }
        if (node.isStatic) node.cell = cell;
        scope.vars.set(node.name, cell); return undefined;
      }
      if (node.isArray) {
        const dims = node.dims.map(d => d ? this.evalExpr(d, scope) : null);
        const build = (level, init) => {
          let len = dims[level];
          if (len === null) len = init && init.type === 'arrinit' ? init.items.length : 0;
          const arr = new Array(len);
          for (let i = 0; i < len; i++) {
            const sub = init && init.type === 'arrinit' ? init.items[i] : null;
            if (level + 1 < dims.length) arr[i] = build(level + 1, sub);
            else arr[i] = sub ? coerce(node.vtype, this.evalExpr(sub, scope)) : (node.vtype === 'String' ? '' : 0);
          }
          return arr;
        };
        cell = { type: node.vtype, val: build(0, node.init), arr: true };
      } else {
        let v = node.vtype === 'String' ? '' : 0;
        if (node.init) v = yield* this.evalG(node.init, scope);
        cell = { type: node.vtype, val: coerce(node.vtype, v), arr: false };
      }
      if (node.isStatic) node.cell = cell;
      scope.vars.set(node.name, cell);
      return undefined;
    }

    /* ---- expressions (synchronous) ---- */
    isFloatNode(n, scope) {
      switch (n.type) {
        case 'num': return n.float;
        case 'id': { const c = scope.lookup(n.name); return c ? FLOAT_TYPES.has(c.type) : false; }
        case 'index': { let b = n; while (b.type === 'index') b = b.base; return this.isFloatNode(b, scope); }
        case 'member': { try { const o = this.evalExpr(n.obj, scope); return FLOAT_TYPES.has(this.fieldOf(o, n.name, n.line).type); } catch (e) { return false; } }
        case 'cast': return FLOAT_TYPES.has(n.ctype);
        case 'call': { if (FLOAT_FUNCS.has(n.name)) return true; const f = this.funcs.get(n.name); return f ? FLOAT_TYPES.has(f.rtype) : false; }
        case 'unary': return this.isFloatNode(n.arg, scope);
        case 'bin': return ['+', '-', '*', '/', '%'].includes(n.op) && (this.isFloatNode(n.l, scope) || this.isFloatNode(n.r, scope));
        case 'cond': return this.isFloatNode(n.a, scope) || this.isFloatNode(n.b, scope);
        case 'assign': return this.isFloatNode(n.target, scope);
        default: return false;
      }
    }
    isCharNode(n, scope) {
      if (n.type === 'chr') return true;
      if (n.type === 'id') { const c = scope.lookup(n.name); return !!c && !c.arr && c.type === 'char'; }
      if (n.type === 'index') { let b = n; while (b.type === 'index') b = b.base; if (b.type === 'id') { const c = scope.lookup(b.name); return !!c && c.type === 'char'; } }
      if (n.type === 'method' && n.name === 'charAt') return true;
      if (n.type === 'cast') return n.ctype === 'char';
      return false;
    }
    getCell(node, scope) {
      const c = scope.lookup(node.name);
      if (!c) throw new ArduinoError("'" + node.name + "' was not declared in this scope", node.line);
      return c;
    }
    lvalue(node, scope) {
      if (node.type === 'id') {
        const c = this.getCell(node, scope);
        if (c.arr) throw new ArduinoError("'" + node.name + "' is an array; use " + node.name + '[index]', node.line);
        return { get: () => c.val, set: v => { c.val = coerce(c.type, v); return c.val; }, type: c.type };
      }
      if (node.type === 'member') {
        const o = this.evalExpr(node.obj, scope), fd = this.fieldOf(o, node.name, node.line);
        if (fd.dims.length) throw new ArduinoError("'" + node.name + "' is an array; use " + node.name + '[index]', node.line);
        return { get: () => o.f[node.name], set: v => (o.f[node.name] = isStruct(v) ? cloneVal(v) : coerce(fd.type, v)), type: fd.type };
      }
      if (node.type === 'index' && node.base.type === 'id' && node.base.name === 'EEPROM' && !scope.lookup('EEPROM')) {
        const idx = Math.trunc(this.evalExpr(node.idx, scope)); this.eeCheck(idx, node.line);
        return { get: () => this.eeprom[idx], set: v => { const b = Math.trunc(v) & 255; if (this.eeprom[idx] !== b) { this.eeprom[idx] = b; this.now += 3.3; } return b; }, type: 'byte' };
      }
      if (node.type === 'index') {
        const arr = this.evalExpr(node.base, scope), idx = this.evalExpr(node.idx, scope);
        if (!Array.isArray(arr)) throw new ArduinoError('subscripted value is not an array', node.line);
        if (idx < 0 || idx >= arr.length) throw new ArduinoError('array index ' + idx + ' is out of range (size ' + arr.length + ')', node.line);
        let b = node; while (b.type === 'index') b = b.base;
        const cell = b.type === 'id' ? scope.lookup(b.name) : null;
        let type = cell ? cell.type : 'int';
        if (b.type === 'member') type = this.fieldOf(this.evalExpr(b.obj, scope), b.name, b.line).type;
        if (isStruct(arr[idx])) return { get: () => arr[idx], set: v => (arr[idx] = cloneVal(v)), type };
        return { get: () => arr[idx], set: v => (arr[idx] = Array.isArray(arr[idx]) ? v : coerce(type, v)), type };
      }
      throw new ArduinoError('invalid assignment target', node.line);
    }
    binop(op, a, b, fl, line) {
      if (op === '+' && (typeof a === 'string' || typeof b === 'string')) return String(a) + String(b);
      if (typeof a === 'string' || typeof b === 'string') {
        if (op === '==') return a === b ? 1 : 0; if (op === '!=') return a !== b ? 1 : 0;
        if (op === '<') return a < b ? 1 : 0; if (op === '>') return a > b ? 1 : 0;
      }
      switch (op) {
        case '+': return a + b; case '-': return a - b; case '*': return a * b;
        case '/':
          if (!fl) { if (b === 0) throw new ArduinoError('Division by zero in integer math (the real board would give garbage)', line); return Math.trunc(a / b); }
          return a / b;
        case '%': if (b === 0) throw new ArduinoError('Modulo by zero', line); return a % b;
        case '<<': return a << b; case '>>': return a >> b;
        case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
        case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
        case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
      }
      throw new ArduinoError('unknown operator ' + op, line);
    }

    evalExpr(n, scope) {
      switch (n.type) {
        case 'num': return n.v;
        case 'chr': return n.v;
        case 'str': return n.v;
        case 'id': {
          const c = scope.lookup(n.name);
          if (c) return c.val;
          if (Object.prototype.hasOwnProperty.call(CONSTS, n.name)) return CONSTS[n.name];
          if (Object.prototype.hasOwnProperty.call(this.enumConsts, n.name)) return this.enumConsts[n.name];
          if (n.name === 'Serial' || n.name === 'EEPROM' || n.name === 'Wire') return 0;
          throw new ArduinoError("'" + n.name + "' was not declared in this scope", n.line);
        }
        case 'unary': {
          const v = this.evalExpr(n.arg, scope);
          switch (n.op) { case '!': return truthy(v) ? 0 : 1; case '-': return -v; case '+': return v; case '~': return ~v; case '&': return v; }   // &Wire: the address of a stub is the stub
          break;
        }
        case 'bin': {
          if (n.op === '&&') return truthy(this.evalExpr(n.l, scope)) && truthy(this.evalExpr(n.r, scope)) ? 1 : 0;
          if (n.op === '||') return truthy(this.evalExpr(n.l, scope)) || truthy(this.evalExpr(n.r, scope)) ? 1 : 0;
          const a = this.evalExpr(n.l, scope), b = this.evalExpr(n.r, scope);
          const fl = (n.op === '/' || n.op === '%') ? (this.isFloatNode(n.l, scope) || this.isFloatNode(n.r, scope)) : false;
          return this.binop(n.op, a, b, fl, n.line);
        }
        case 'cond': return truthy(this.evalExpr(n.c, scope)) ? this.evalExpr(n.a, scope) : this.evalExpr(n.b, scope);
        case 'cast': return coerce(n.ctype, this.evalExpr(n.arg, scope));
        case 'member': { const o = this.evalExpr(n.obj, scope); this.fieldOf(o, n.name, n.line); return o.f[n.name]; }
        case 'index': {
          if (n.base.type === 'id' && n.base.name === 'EEPROM' && !scope.lookup('EEPROM')) { const i = Math.trunc(this.evalExpr(n.idx, scope)); this.eeCheck(i, n.line); return this.eeprom[i]; }
          const arr = this.evalExpr(n.base, scope), idx = this.evalExpr(n.idx, scope);
          if (typeof arr === 'string') return idx >= 0 && idx < arr.length ? arr.charCodeAt(idx) : 0;
          if (!Array.isArray(arr)) throw new ArduinoError('subscripted value is not an array', n.line);
          if (idx < 0 || idx >= arr.length) throw new ArduinoError('array index ' + idx + ' is out of range (size ' + arr.length + ')', n.line);
          return arr[idx];
        }
        case 'assign': {
          const lv = this.lvalue(n.target, scope);
          let v = this.evalExpr(n.value, scope);
          if (n.op !== '=') {
            const op = n.op.slice(0, -1);
            const fl = (op === '/' || op === '%') ? (FLOAT_TYPES.has(lv.type) || this.isFloatNode(n.value, scope)) : false;
            v = this.binop(op, lv.get(), v, fl, n.line);
          }
          if (isStruct(v)) v = cloneVal(v);
          return lv.set(v);
        }
        case 'incdec': {
          const lv = this.lvalue(n.arg, scope);
          const old = lv.get();
          const nv = lv.set(n.op === '++' ? old + 1 : old - 1);
          return n.prefix ? nv : old;
        }
        case 'sizeofT': return this.sizeOfType(n.ctype);
        case 'sizeofE': {
          if (n.arg.type === 'id') { const c = scope.lookup(n.arg.name); if (c) return c.arr ? c.val.length * this.sizeOfType(c.type) : this.sizeOfType(c.type); }
          return 2;
        }
        case 'call': return this.callBuiltin(n, scope);
        case 'method': return this.callMethod(n, scope);
        case 'arrinit': throw new ArduinoError('unexpected { } list', n.line);
      }
      throw new ArduinoError('cannot evaluate ' + n.type, n.line);
    }

    /* ---- pin helpers ---- */
    pinNo(v, line, fn) {
      v = Math.trunc(v);
      if (v >= 0 && v <= 5 && fn === 'analogRead') v += 14;
      if (v < 0 || v > 19) { this.warnOnce('pin' + v + fn, 'Pin ' + v + ' does not exist on an Arduino Uno (valid: 0-13 and A0-A5).', line); return -1; }
      return v;
    }
    digitalReadPin(p) {
      const v = this.pinVolts[p];
      if (v > 3.0) this.pinRead[p] = 1; else if (v < 1.5) this.pinRead[p] = 0;
      return this.pinRead[p];
    }

    callBuiltin(n, scope) {
      const name = n.name, line = n.line;
      const fn = this.funcs.get(name);
      if (fn) return this.driveSync(this.callUser(fn, n.args.map(a => this.evalExpr(a, scope)), line));
      if (name === 'attachInterrupt') {
        if (n.args.length !== 3) throw new ArduinoError('attachInterrupt(interrupt, handler, mode) needs 3 arguments', line);
        const k = Math.trunc(this.evalExpr(n.args[0], scope)), mode = this.evalExpr(n.args[2], scope), h = n.args[1];
        if (k !== 0 && k !== 1) throw new ArduinoError('attachInterrupt: the Uno only has two interrupt pins, D2 (INT0) and D3 (INT1). Use digitalPinToInterrupt(2) or digitalPinToInterrupt(3).', line);
        const fn = h.type === 'id' ? this.funcs.get(h.name) : null;
        if (!fn) throw new ArduinoError('attachInterrupt: the second argument must be the name of a function, for example void onPress() { ... }', line);
        if (fn.params.length) throw new ArduinoError("the interrupt handler '" + fn.name + "' must take no parameters", line);
        this.isrs[k] = { fn, mode }; return 0;
      }
      const a = n.args.map(x => this.evalExpr(x, scope));
      const need = k => { if (a.length < k) throw new ArduinoError(name + '() needs ' + k + ' argument(s)', line); };
      switch (name) {
        case 'pinMode': {
          need(2); const p = this.pinNo(a[0], line, name); if (p < 0) return 0;
          this.pinMode[p] = a[1]; if (a[1] === 2 && this.pinVolts[p] < 1) this.pinVolts[p] = 5; this.emit('mode', p, a[1]); return 0;
        }
        case 'digitalWrite': {
          need(2); const p = this.pinNo(a[0], line, name); if (p < 0) return 0;
          if (this.pinMode[p] === 0 && !this.warned['dw' + p]) {
            if (a[1]) this.warnOnce('dw' + p, 'digitalWrite(' + p + ', HIGH) on a pin that is not OUTPUT: this only switches the internal pull-up. Did you forget pinMode(' + p + ', OUTPUT)?', line);
          }
          this.pinOut[p] = a[1] ? 1 : 0; this.emit('dw', p, this.pinOut[p]);
          if (this.pinOut[p]) this.pinRise[p] = this.now;
          else if (this.pinRise[p] !== undefined) { this.pinPulse[p] = { rise: this.pinRise[p], fall: this.now }; this.pinRise[p] = undefined; }
          return 0;
        }
        case 'digitalRead': { need(1); const p = this.pinNo(a[0], line, name); return p < 0 ? 0 : this.digitalReadPin(p); }
        case 'analogRead': {
          need(1); const p = this.pinNo(a[0], line, name); if (p < 14) { if (p >= 0) this.warnOnce('ar' + p, 'analogRead() works on A0-A5 only.', line); return 0; }
          return Math.max(0, Math.min(1023, Math.round(this.pinVolts[p] / 5 * 1023)));
        }
        case 'analogWrite': {
          need(2); const p = this.pinNo(a[0], line, name); if (p < 0) return 0;
          const v = Math.max(0, Math.min(255, Math.trunc(a[1])));
          if (![3, 5, 6, 9, 10, 11].includes(p)) this.warnOnce('pwm' + p, 'Pin ' + p + ' has no PWM on the Uno (use 3, 5, 6, 9, 10 or 11). analogWrite will act like digitalWrite.', line);
          this.emit('pwm', p, v); return 0;
        }
        case 'pulseIn': case 'pulseInLong': {
          need(2); const p = this.pinNo(a[0], line, name); if (p < 0) return 0;
          const level = a[1] ? 1 : 0, timeoutUs = a.length > 2 ? a[2] : 1000000;
          const r = this.oracle ? this.oracle(p, level, this.now) : null;
          if (r && level === 1 && (r.end - this.now) * 1000 <= timeoutUs) { const w = Math.round((r.end - r.start) * 1000); this.now = Math.max(this.now, r.end); return w; }
          this.now += timeoutUs / 1000;                   // nothing arrived: like the real function, wait for the timeout and return 0
          return 0;
        }
        case 'tone': { need(2); const p = this.pinNo(a[0], line, name); if (p >= 0) this.emit('tone', p, a[1], { dur: a[2] || 0 }); return 0; }
        case 'noTone': { need(1); const p = this.pinNo(a[0], line, name); if (p >= 0) this.emit('tone', p, 0); return 0; }
        case 'delay': this.now += Math.max(0, a[0]); return 0;
        case 'delayMicroseconds': this.now += Math.max(0, a[0]) / 1000; return 0;
        case 'millis': return Math.floor(this.now) >>> 0;
        case 'micros': return Math.floor(this.now * 1000) >>> 0;
        case 'makeKeymap': need(1); return a[0];
        case 'map': need(5); return a[3] + Math.trunc((a[0] - a[1]) * (a[4] - a[3]) / ((a[2] - a[1]) || 1));
        case 'constrain': need(3); return a[0] < a[1] ? a[1] : (a[0] > a[2] ? a[2] : a[0]);
        case 'min': return Math.min(a[0], a[1]); case 'max': return Math.max(a[0], a[1]);
        case 'abs': case 'fabs': return Math.abs(a[0]); case 'sq': return a[0] * a[0];
        case 'sqrt': return Math.sqrt(a[0]); case 'pow': return Math.pow(a[0], a[1]);
        case 'sin': return Math.sin(a[0]); case 'cos': return Math.cos(a[0]); case 'tan': return Math.tan(a[0]);
        case 'atan': return Math.atan(a[0]); case 'atan2': return Math.atan2(a[0], a[1]);
        case 'exp': return Math.exp(a[0]); case 'log': return Math.log(a[0]);
        case 'floor': return Math.floor(a[0]); case 'ceil': return Math.ceil(a[0]); case 'round': return Math.round(a[0]);
        case 'random': return a.length === 1 ? Math.floor(this.random01() * a[0]) : a[0] + Math.floor(this.random01() * (a[1] - a[0]));
        case 'randomSeed': this.rng = (Math.trunc(a[0]) >>> 0) || 1; return 0;
        case 'bitRead': return (a[0] >> a[1]) & 1;
        case 'bitSet': return a[0] | (1 << a[1]); case 'bitClear': return a[0] & ~(1 << a[1]);
        case 'bitWrite': return a[2] ? (a[0] | (1 << a[1])) : (a[0] & ~(1 << a[1]));
        case 'lowByte': return a[0] & 0xFF; case 'highByte': return (a[0] >> 8) & 0xFF;
        case 'isDigit': return /[0-9]/.test(String.fromCharCode(a[0])) ? 1 : 0;
        case 'isAlpha': return /[A-Za-z]/.test(String.fromCharCode(a[0])) ? 1 : 0;
        case 'F': case 'String': return typeof a[0] === 'string' ? a[0] : String(a[0] === undefined ? '' : a[0]);
        case 'int': case 'long': case 'byte': case 'char': case 'float': case 'double': case 'word':
          if (name === 'word' && a.length === 2) return ((a[0] & 255) << 8) | (a[1] & 255);
          return coerce(name, a[0]);
        case 'digitalPinToInterrupt': need(1); return a[0] === 2 ? 0 : a[0] === 3 ? 1 : -1;
        case 'detachInterrupt': need(1); if (this.isrs[a[0]]) { this.isrs[a[0]] = null; this.isrPend[a[0]] = false; } return 0;
        case 'sei': case 'interrupts': this.intEnabled = true; return 0;
        case 'cli': case 'noInterrupts': this.intEnabled = false; return 0;
        case 'shiftOut': {
          need(4); const d = this.pinNo(a[0], line, name), c = this.pinNo(a[1], line, name); if (d < 0 || c < 0) return 0;
          if (this.pinMode[d] !== 1 || this.pinMode[c] !== 1) this.warnOnce('so' + d + c, 'shiftOut(): pinMode(' + (this.pinMode[d] !== 1 ? d : c) + ', OUTPUT) was not called for that pin.', line);
          const val = Math.trunc(a[3]) & 255;
          for (let i = 0; i < 8; i++) {
            const bit = a[2] === 1 ? (val >> (7 - i)) & 1 : (val >> i) & 1;
            this.pinOut[d] = bit; this.emit('dw', d, bit); this.now += 0.002;
            this.pinOut[c] = 1; this.emit('dw', c, 1); this.now += 0.003;
            this.pinOut[c] = 0; this.emit('dw', c, 0); this.now += 0.003;
          }
          return 0;
        }
        case 'cbrt': return Math.cbrt(a[0]); case 'asin': return Math.asin(a[0]); case 'acos': return Math.acos(a[0]);
        case 'sinh': return Math.sinh(a[0]); case 'cosh': return Math.cosh(a[0]); case 'tanh': return Math.tanh(a[0]);
        case 'log10': return Math.log10(a[0]); case 'log2': return Math.log2(a[0]); case 'hypot': return Math.hypot(a[0], a[1]);
        case 'fmod': return a[1] === 0 ? NaN : a[0] % a[1]; case 'trunc': return Math.trunc(a[0]);
        case 'radians': return a[0] * Math.PI / 180; case 'degrees': return a[0] * 180 / Math.PI;
        case 'fmin': return Math.min(a[0], a[1]); case 'fmax': return Math.max(a[0], a[1]);
        case 'isnan': return Number.isNaN(a[0]) ? 1 : 0; case 'isinf': return (a[0] === Infinity || a[0] === -Infinity) ? 1 : 0;
        case 'bit': case '_BV': return 1 << a[0];
        case 'word': case 'makeWord': return a.length === 1 ? a[0] & 0xFFFF : (((a[0] & 255) << 8) | (a[1] & 255));
        case 'sgn': return Math.sign(a[0]);
        case 'isSpace': return /\s/.test(String.fromCharCode(a[0])) ? 1 : 0;
        case 'isUpperCase': return /[A-Z]/.test(String.fromCharCode(a[0])) ? 1 : 0;
        case 'isLowerCase': return /[a-z]/.test(String.fromCharCode(a[0])) ? 1 : 0;
        case 'isAlphaNumeric': return /[A-Za-z0-9]/.test(String.fromCharCode(a[0])) ? 1 : 0;
        case 'toUpperCase': return String.fromCharCode(a[0]).toUpperCase().charCodeAt(0);
        case 'toLowerCase': return String.fromCharCode(a[0]).toLowerCase().charCodeAt(0);
        case 'analogReference':
          this.warnOnce('ni' + name, name + '() is accepted but not simulated.', line); return 0;
      }
      throw new ArduinoError("'" + name + "' was not declared in this scope (unknown function)", line);
    }

    serialText(node, scope, a) {
      const v = a[0];
      if (typeof v === 'string') return v;
      if (this.isCharNode(node, scope)) return String.fromCharCode(v);
      if (this.isFloatNode(node, scope)) return fmtFloat(v, a.length > 1 ? a[1] : 2);
      if (a.length > 1 && [2, 8, 16].includes(a[1])) { const s = (v >>> 0).toString(a[1]); return a[1] === 16 ? s.toUpperCase() : s; }
      return String(v);
    }

    libCall(obj, name, a, n, scope) {
      const line = n.line;
      if (obj.__lib === 'Servo') {
        switch (name) {
          case 'attach': {
            const p = this.pinNo(a[0], line, 'attach'); if (p < 0) return 0;
            obj.pin = p; obj.attached = true; this.pinMode[p] = 1; this.emit('mode', p, 1); this.emit('servo', p, obj.angle); return 0;
          }
          case 'detach': if (obj.attached) { this.emit('servo', obj.pin, -1); obj.attached = false; } return 0;
          case 'write': case 'writeMicroseconds': {
            let ang = name === 'write' ? a[0] : (a[0] - 544) / (2400 - 544) * 180;
            if (name === 'write' && a[0] >= 544) ang = (a[0] - 544) / (2400 - 544) * 180;   // the library treats big numbers as microseconds
            ang = Math.max(0, Math.min(180, Math.round(ang))); obj.angle = ang;
            if (obj.attached) this.emit('servo', obj.pin, ang);
            else this.warnOnce('servo-attach', 'servo.write() was called before servo.attach(pin): nothing will move.', line);
            return 0;
          }
          case 'read': return Math.round(obj.angle);
          case 'attached': return obj.attached ? 1 : 0;
        }
        throw new ArduinoError('Servo.' + name + '() is not supported', line);
      }
      if (obj.__lib === 'Stepper') {
        switch (name) {
          case 'setSpeed': { const rpm = a[0]; if (!(rpm > 0)) throw new ArduinoError('Stepper.setSpeed() needs a speed above 0 rpm', line); obj.delay = 60000 / (obj.steps * rpm); obj.speedSet = true; return 0; }
          case 'step': {
            if (!obj.speedSet) this.warnOnce('stepper-speed', 'Call stepper.setSpeed(rpm) before stepper.step(): the default of 10 rpm is used.', line);
            let n = Math.trunc(a[0]); const dir = n >= 0 ? 1 : -1; n = Math.abs(n);
            const SEQ4 = [[1, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]], SEQ2 = [[0, 1], [1, 1], [1, 0], [0, 0]];
            for (let k = 0; k < n; k++) {
              obj.stepNo = (obj.stepNo + dir + 4) % 4;
              const pat = obj.pins.length === 4 ? SEQ4[obj.stepNo] : SEQ2[obj.stepNo];
              obj.pins.forEach((p, j) => { this.pinOut[p] = pat[j]; this.emit('dw', p, pat[j]); });
              this.now += obj.delay;
            }
            return 0;
          }
          case 'version': return 5;
        }
        throw new ArduinoError('Stepper.' + name + '() is not supported', line);
      }
      if (obj.__lib === 'Keypad') {
        switch (name) {
          case 'getKey': {
            let key = 0;
            if (this.keypadScan) { const hit = this.keypadScan(obj.rowPins, obj.colPins); if (hit) { const row = obj.keymap[hit[0]]; key = row ? row[hit[1]] || 0 : 0; } }
            if (key && key !== obj.last) { obj.last = key; return key; }
            if (!key) obj.last = 0;
            return 0;
          }
          case 'getState': return obj.last ? 1 : 0;
          case 'isPressed': { let hit = this.keypadScan ? this.keypadScan(obj.rowPins, obj.colPins) : null; const row = hit ? obj.keymap[hit[0]] : null; return row && row[hit[1]] === a[0] ? 1 : 0; }
          case 'setDebounceTime': case 'setHoldTime': case 'addEventListener': return 0;
        }
        throw new ArduinoError('Keypad.' + name + '() is not supported (use getKey() and isPressed())', line);
      }
      if (obj.__lib === 'DHT') {
        switch (name) {
          case 'begin': obj.began = true; if (obj.pin >= 0 && obj.pin < 20) { this.pinMode[obj.pin] = 2; this.emit('mode', obj.pin, 2); } return 0;
          case 'readTemperature': case 'readHumidity': {
            if (!obj.began) this.warnOnce('dht-begin', 'Call dht.begin() in setup() before reading the sensor.', line);
            const r = this.dhtRead ? this.dhtRead(obj.pin, obj.model) : null; if (!r) return NaN;
            if (name === 'readHumidity') return r.h;
            return a.length && a[0] ? r.t * 9 / 5 + 32 : r.t;
          }
          case 'computeHeatIndex': { const f = a.length > 2 ? !!a[2] : true; let t = a[0], h = a[1]; if (!f) t = t * 9 / 5 + 32; const hi = -42.379 + 2.04901523 * t + 10.14333127 * h - 0.22475541 * t * h - 0.00683783 * t * t - 0.05481717 * h * h + 0.00122874 * t * t * h + 0.00085282 * t * h * h - 0.00000199 * t * t * h * h; return f ? hi : (hi - 32) * 5 / 9; }
          case 'convertCtoF': return a[0] * 9 / 5 + 32; case 'convertFtoC': return (a[0] - 32) * 5 / 9;
        }
        throw new ArduinoError('DHT.' + name + '() is not supported (use begin, readTemperature, readHumidity)', line);
      }
      if (obj.__lib === 'OLED') {
        const W = obj.w, H = obj.h, px = (x, y, c) => { x = Math.trunc(x); y = Math.trunc(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (c === 2) obj.buf[i] ^= 1; else obj.buf[i] = c ? 1 : 0; };
        const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
        const lineF = (x0, y0, x1, y1, c) => { x0 = Math.trunc(x0); y0 = Math.trunc(y0); x1 = Math.trunc(x1); y1 = Math.trunc(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, g = 0; for (;;) { px(x0, y0, c); if (x0 === x1 && y0 === y1 || ++g > 4000) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } };
        const circ = (cx, cy, r, c, fill) => { r = Math.trunc(r); let x = r, y = 0, err = 1 - r; while (x >= y) { if (fill) { for (const [a, b] of [[x, y], [y, x]]) { lineF(cx - a, cy + b, cx + a, cy + b, c); lineF(cx - a, cy - b, cx + a, cy - b, c); } } else for (const [a, b] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) px(cx + a, cy + b, c); y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; } } };
        const wr = ch => {
          if (ch === 10) { obj.cx = 0; obj.cy += obj.size * 8; return; } if (ch === 13) return;
          if (obj.wrap && obj.cx + obj.size * 6 > W) { obj.cx = 0; obj.cy += obj.size * 8; }
          const g = FONT5x7[ch - 32] || FONT5x7[0];
          for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) if ((g[i] >> j) & 1) rect(obj.cx + i * obj.size, obj.cy + j * obj.size, obj.size, obj.size, obj.color);
          obj.cx += obj.size * 6;
        };
        switch (name) {
          case 'begin': obj.inited = true; obj.addr = a.length > 1 ? Math.trunc(a[1]) : 0x3C; return 1;
          case 'clearDisplay': obj.buf.fill(0); return 0;
          case 'display': if (!obj.inited) this.warnOnce('oled-begin', 'Call display.begin(SSD1306_SWITCHCAPVCC, 0x3C) in setup() first: until then the screen stays dark.', line); obj.shown = obj.buf.slice(); obj.ver++; return 0;
          case 'setTextSize': obj.size = Math.max(1, Math.trunc(a[0])); return 0;
          case 'setTextColor': obj.color = a[0] === 2 ? 2 : (a[0] ? 1 : 0); return 0;
          case 'setCursor': obj.cx = Math.trunc(a[0]); obj.cy = Math.trunc(a[1]); return 0;
          case 'setTextWrap': obj.wrap = !!a[0]; return 0;
          case 'print': case 'println': { const s = n.args.length ? this.serialText(n.args[0], scope, a) : ''; for (const ch of s) wr(ch.charCodeAt(0)); if (name === 'println') wr(10); return s.length; }
          case 'write': wr(typeof a[0] === 'string' ? a[0].charCodeAt(0) : a[0]); return 1;
          case 'drawPixel': px(a[0], a[1], a[2]); return 0;
          case 'drawLine': lineF(a[0], a[1], a[2], a[3], a[4]); return 0;
          case 'drawFastHLine': lineF(a[0], a[1], a[0] + a[2] - 1, a[1], a[3]); return 0;
          case 'drawFastVLine': lineF(a[0], a[1], a[0], a[1] + a[2] - 1, a[3]); return 0;
          case 'drawRect': case 'drawRoundRect': { const [x, y, w, h, c] = name === 'drawRect' ? a : [a[0], a[1], a[2], a[3], a[5]]; lineF(x, y, x + w - 1, y, c); lineF(x, y + h - 1, x + w - 1, y + h - 1, c); lineF(x, y, x, y + h - 1, c); lineF(x + w - 1, y, x + w - 1, y + h - 1, c); return 0; }
          case 'fillRect': rect(Math.trunc(a[0]), Math.trunc(a[1]), Math.trunc(a[2]), Math.trunc(a[3]), a[4]); return 0;
          case 'fillRoundRect': rect(Math.trunc(a[0]), Math.trunc(a[1]), Math.trunc(a[2]), Math.trunc(a[3]), a[5]); return 0;
          case 'fillScreen': obj.buf.fill(a[0] ? 1 : 0); return 0;
          case 'drawCircle': circ(Math.trunc(a[0]), Math.trunc(a[1]), a[2], a[3], false); return 0;
          case 'fillCircle': circ(Math.trunc(a[0]), Math.trunc(a[1]), a[2], a[3], true); return 0;
          case 'drawTriangle': lineF(a[0], a[1], a[2], a[3], a[6]); lineF(a[2], a[3], a[4], a[5], a[6]); lineF(a[4], a[5], a[0], a[1], a[6]); return 0;
          case 'drawBitmap': { const bm = a[2], bw = Math.trunc(a[3]), bh = Math.trunc(a[4]), span = (bw + 7) >> 3; if (Array.isArray(bm)) for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) if ((bm[j * span + (i >> 3)] >> (7 - (i & 7))) & 1) px(a[0] + i, a[1] + j, a[5]); return 0; }
          case 'invertDisplay': obj.invert = !!a[0]; obj.ver++; return 0;
          case 'dim': case 'startscrollright': case 'startscrollleft': case 'stopscroll': return 0;
          case 'width': return W; case 'height': return H;
        }
        throw new ArduinoError('Adafruit_SSD1306.' + name + '() is not supported here (text, pixels, lines, rectangles, circles and bitmaps are)', line);
      }
      // LiquidCrystal
      const put = ch => { if (obj.row < obj.rows && obj.col < obj.cols) { const L = obj.lines[obj.row]; obj.lines[obj.row] = L.slice(0, obj.col) + ch + L.slice(obj.col + 1); } obj.col++; };
      switch (name) {
        case 'init': case 'backlight': case 'noBacklight': if (name === 'init') obj.inited = true; else obj.backlight = name === 'backlight'; if (name === 'init') obj.backlight = obj.backlight || false; return 0;
        case 'begin': obj.cols = Math.trunc(a[0]) || obj.cols || 16; obj.rows = Math.trunc(a[1]) || obj.rows || 2; obj.inited = true; obj.lines = Array.from({ length: obj.rows }, () => ' '.repeat(obj.cols)); obj.col = obj.row = 0; return 0;
        case 'clear': obj.lines = obj.lines.map(() => ' '.repeat(obj.cols)); obj.col = obj.row = 0; return 0;
        case 'home': obj.col = obj.row = 0; return 0;
        case 'setCursor': obj.col = Math.trunc(a[0]); obj.row = Math.trunc(a[1]); return 0;
        case 'print': { const s = n.args.length ? this.serialText(n.args[0], scope, a) : ''; for (const ch of s) put(ch); return s.length; }
        case 'write': put(typeof a[0] === 'string' ? a[0] : String.fromCharCode(a[0])); return 1;
        case 'display': obj.display = true; return 0;
        case 'noDisplay': obj.display = false; return 0;
        case 'cursor': case 'noCursor': case 'blink': case 'noBlink': case 'leftToRight': case 'rightToLeft': case 'autoscroll': case 'noAutoscroll': return 0;
        case 'createChar': case 'scrollDisplayLeft': case 'scrollDisplayRight':
          this.warnOnce('lcd-' + name, 'lcd.' + name + '() is accepted but not simulated.', line); return 0;
      }
      throw new ArduinoError('LiquidCrystal.' + name + '() is not supported', line);
    }

    eeCheck(i, line) { if (!(i >= 0 && i < this.eeprom.length)) throw new ArduinoError('EEPROM address ' + i + ' is out of range (0 to ' + (this.eeprom.length - 1) + ').', line); }
    // static type of an expression, for EEPROM.put / get: {type, dims}
    typeOfNode(node, scope) {
      if (node.type === 'id') { const c = scope.lookup(node.name); if (c) return { type: c.type, arr: c.arr }; }
      if (node.type === 'member') { const o = this.evalExpr(node.obj, scope), fd = this.fieldOf(o, node.name, node.line); return { type: fd.type, arr: fd.dims.length > 0 }; }
      if (node.type === 'index') { let b = node; while (b.type === 'index') b = b.base; const t = this.typeOfNode(b, scope); return { type: t.type, arr: false }; }
      return { type: this.isFloatNode(node, scope) ? 'float' : 'int', arr: false };
    }
    eeWrite(addr, v, type, line) {
      const d = this.structs.get(type);
      if (Array.isArray(v)) { for (const x of v) addr = this.eeWrite(addr, x, type, line); return addr; }
      if (d) { for (const f of d.fields) addr = this.eeWrite(addr, v.f[f.name], f.type, line); return addr; }
      if (type === 'String' || typeof v === 'string') throw new ArduinoError("EEPROM.put() cannot store a String object. Store a char array or the individual bytes instead.", line);
      const size = typeSize(type), bytes = [];
      if (type === 'float' || type === 'double') { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, v, true); for (let i = 0; i < 4; i++) bytes.push(dv.getUint8(i)); }
      else { let x = Math.trunc(v) >>> 0; for (let i = 0; i < size; i++) { bytes.push(x & 255); x = Math.floor(x / 256); } }
      bytes.forEach((b, i) => { this.eeCheck(addr + i, line); if (this.eeprom[addr + i] !== b) { this.eeprom[addr + i] = b; this.now += 3.3; } });
      return addr + size;
    }
    eeRead(addr, type, template, line) {
      const d = this.structs.get(type);
      if (Array.isArray(template)) { for (let i = 0; i < template.length; i++) { const r = this.eeRead(addr, type, template[i], line); addr = r.addr; template[i] = r.val; } return { addr, val: template }; }
      if (d) { for (const f of d.fields) { const r = this.eeRead(addr, f.type, template.f[f.name], line); addr = r.addr; template.f[f.name] = r.val; } return { addr, val: template }; }
      const size = typeSize(type); for (let i = 0; i < size; i++) this.eeCheck(addr + i, line);
      let val;
      if (type === 'float' || type === 'double') { const dv = new DataView(new ArrayBuffer(4)); for (let i = 0; i < 4; i++) dv.setUint8(i, this.eeprom[addr + i]); val = dv.getFloat32(0, true); }
      else { let x = 0; for (let i = size - 1; i >= 0; i--) x = x * 256 + this.eeprom[addr + i]; val = coerce(type, x); }
      return { addr: addr + size, val };
    }
    callMethod(n, scope) {
      const line = n.line, o = n.obj;
      if (o.type === 'id' && o.name === 'EEPROM' && !scope.lookup('EEPROM')) {
        const m = n.name, a = m === 'get' ? [this.evalExpr(n.args[0], scope)] : n.args.map(x => this.evalExpr(x, scope));
        switch (m) {
          case 'read': { const i = Math.trunc(a[0]); this.eeCheck(i, line); return this.eeprom[i]; }
          case 'write': case 'update': { const i = Math.trunc(a[0]); this.eeCheck(i, line); const b = Math.trunc(a[1]) & 255; if (this.eeprom[i] !== b) { this.eeprom[i] = b; this.now += 3.3; } return 0; }
          case 'length': return this.eeprom.length;
          case 'put': { if (n.args.length !== 2) throw new ArduinoError('EEPROM.put(address, value) needs 2 arguments', line); const t = this.typeOfNode(n.args[1], scope); this.eeWrite(Math.trunc(a[0]), a[1], t.type, line); return a[1]; }
          case 'get': {
            if (n.args.length !== 2) throw new ArduinoError('EEPROM.get(address, variable) needs 2 arguments', line);
            const t = this.typeOfNode(n.args[1], scope), tgt = n.args[1];
            if (!['id', 'member', 'index'].includes(tgt.type)) throw new ArduinoError('EEPROM.get(): the second argument must be a variable', line);
            const cur = this.evalExpr(tgt, scope), r = this.eeRead(Math.trunc(a[0]), t.type, (Array.isArray(cur) || isStruct(cur)) ? cur : 0, line);
            if (!Array.isArray(cur) && !isStruct(cur)) this.lvalue(tgt, scope).set(r.val);
            return r.val;
          }
        }
        throw new ArduinoError('EEPROM.' + m + '() is not supported (use read, write, update, put, get, length)', line);
      }
      const a = n.args.map(x => this.evalExpr(x, scope));
      if (o.type === 'id' && o.name === 'Wire' && !scope.lookup('Wire')) {
        switch (n.name) {
          case 'begin': case 'setClock': case 'end': return 0;
          case 'available': case 'read': case 'requestFrom': return 0;
          default: this.warnOnce('wire-raw', 'Raw I²C (Wire.' + n.name + ') is not simulated. Use a library for the device instead: LiquidCrystal_I2C, Adafruit_SSD1306 or DHT.', line); return 0;
        }
      }
      if (o.type === 'id' && o.name === 'Serial') {
        const m = n.name;
        const out = s => {
          if (!this.serialBegan) { this.warnOnce('serial', 'Serial.begin() was never called, so nothing is printed. Add Serial.begin(9600); in setup().', line); return; }
          this.onSerial(s, this.now);
        };
        switch (m) {
          case 'begin': this.serialBegan = true; return 0;
          case 'end': this.serialBegan = false; return 0;
          case 'print': out(a.length ? this.serialText(n.args[0], scope, a) : ''); return 0;
          case 'println': out((a.length ? this.serialText(n.args[0], scope, a) : '') + '\n'); return 0;
          case 'write': out(typeof a[0] === 'string' ? a[0] : String.fromCharCode(a[0])); return 0;
          case 'available': return this.serialIn.length;
          case 'read': return this.serialIn.length ? this.serialIn.shift() : -1;
          case 'peek': return this.serialIn.length ? this.serialIn[0] : -1;
          case 'parseInt': {
            while (this.serialIn.length && !/[-0-9]/.test(String.fromCharCode(this.serialIn[0]))) this.serialIn.shift();
            let s = ''; while (this.serialIn.length && /[-0-9]/.test(String.fromCharCode(this.serialIn[0]))) s += String.fromCharCode(this.serialIn.shift());
            return parseInt(s, 10) || 0;
          }
          case 'readStringUntil': case 'readString': {
            let s = ''; const stop = m === 'readStringUntil' ? a[0] : -1;
            while (this.serialIn.length) { const c = this.serialIn.shift(); if (c === stop) break; s += String.fromCharCode(c); }
            return s;
          }
          case 'flush': case 'setTimeout': return 0;
        }
        throw new ArduinoError('Serial.' + m + '() is not supported', line);
      }
      const s = this.evalExpr(o, scope);
      if (s && typeof s === 'object' && s.__lib) return this.libCall(s, n.name, a, n, scope);
      if (typeof s === 'string') {
        switch (n.name) {
          case 'length': return s.length;
          case 'charAt': return a[0] >= 0 && a[0] < s.length ? s.charCodeAt(a[0]) : 0;
          case 'substring': return s.substring(a[0], a.length > 1 ? a[1] : undefined);
          case 'indexOf': return s.indexOf(typeof a[0] === 'number' ? String.fromCharCode(a[0]) : a[0]);
          case 'toInt': return parseInt(s, 10) || 0;
          case 'toFloat': return parseFloat(s) || 0;
          case 'toUpperCase': return s.toUpperCase();
          case 'toLowerCase': return s.toLowerCase();
          case 'equals': return s === String(a[0]) ? 1 : 0;
          case 'startsWith': return s.startsWith(a[0]) ? 1 : 0;
          case 'trim': return s.trim();
          case 'concat': return s + String(a[0]);
        }
      }
      throw new ArduinoError("unknown method '." + n.name + "()'", line);
    }
  }

  /* ============================== static checks ============================== */
  function lint(program, src) {
    const warns = [];
    const consts = {};
    for (const g of program.globals) {
      const list = g.type === 'decls' ? g.list : [g];
      for (const d of list) if (d.type === 'decl' && !d.isArray && d.init && d.init.type === 'num') consts[d.name] = d.init.v;
    }
    const resolve = n => (n.type === 'num' ? n.v : n.type === 'id' ? (consts[n.name] ?? CONSTS[n.name]) : undefined);
    const modes = new Set(), writes = [];
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.type === 'call') {
        const p = node.args[0] && resolve(node.args[0]);
        if (node.name === 'pinMode' && p !== undefined) modes.add(p);
        if ((node.name === 'digitalWrite') && p !== undefined) writes.push({ p, line: node.line });
      }
      if (node.type === 'if' || node.type === 'while') {
        if (node.cond && node.cond.type === 'assign' && node.cond.op === '=') warns.push({ line: node.line, msg: "'=' inside a condition assigns a value. Did you mean '==' to compare?" });
      }
      for (const k of Object.keys(node)) if (k !== 'cell') walk(node[k]);
    };
    for (const f of program.funcs.values()) walk(f.body);
    const seen = new Set();
    for (const w of writes) if (!modes.has(w.p) && !seen.has(w.p)) { seen.add(w.p); warns.push({ line: w.line, msg: 'digitalWrite() on pin ' + w.p + ' but no pinMode(' + w.p + ', OUTPUT) found.' }); }
    return warns;
  }

  function compile(src) {
    try {
      const tokens = tokenize(src);
      const program = new Parser(tokens).parseProgram();
      if (!program.funcs.has('setup')) throw new ArduinoError("Your sketch needs a 'void setup()' function.", 1);
      if (!program.funcs.has('loop')) throw new ArduinoError("Your sketch needs a 'void loop()' function.", 1);
      return { ok: true, program, warnings: lint(program, src) };
    } catch (e) {
      if (e instanceof ArduinoError) return { ok: false, error: e };
      throw e;
    }
  }

  const api = { compile, Interpreter, ArduinoError, tokenize, CONSTS };
  root.S21 = root.S21 || {};
  root.S21.Arduino = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
