// Arduino language, round 2: struct, enum, typedef, EEPROM, interrupts, shiftOut, math
const { compile, Interpreter } = require('../src/js/arduino/interp.js');
let fails = 0;
function check(name, cond, extra) { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond ? '' : '   ' + (extra || ''))); }
function run(src, ms, setup) {
  const c = compile(src);
  if (!c.ok) return { err: c.error.message + ' (line ' + c.error.line + ')' };
  const it = new Interpreter(c.program);
  let out = ''; it.onSerial = s => out += s; const warns = []; it.onWarn = m => warns.push(m);
  if (setup) setup(it);
  it.runUntil(ms || 50, 5e6);
  return { it, out, warns, err: it.error ? it.error.message : null, ev: it.events };
}
const lines = r => r.out.trim().split('\n').map(s => s.trim());

// ---- struct
let r = run(`struct Point { int x; int y; };
struct Led { byte pin; Point pos; float level; bool on; };
Point origin = {10, 20};
Led leds[2] = { {3, {1, 2}, 0.5, true}, {5, {3, 4}, 0.25, false} };
int sum(Point p) { return p.x + p.y; }
void bump(Point &p) { p.x += 100; }
Point make(int a, int b) { Point p; p.x = a; p.y = b; return p; }
void setup() {
  Serial.begin(9600);
  Serial.println(origin.x); Serial.println(origin.y);
  Point q = origin; q.x = 99; Serial.println(origin.x); Serial.println(q.x);
  Serial.println(leds[1].pos.y); Serial.println(leds[0].level); Serial.println(leds[1].on);
  leds[0].pos.x += 5; Serial.println(leds[0].pos.x);
  Serial.println(sum(origin)); bump(q); Serial.println(q.x); Serial.println(origin.x);
  Point m = make(7, 8); Serial.println(m.x * m.y);
  Serial.println(sizeof(Point)); Serial.println(sizeof(Led)); Serial.println(sizeof(leds));
  leds[0].level = leds[0].level / 2; Serial.println(leds[0].level);
  Point z; Serial.println(z.x);
}
void loop() {}`);
check('struct program compiles & runs', !r.err, r.err);
if (!r.err) {
  const L = lines(r);
  check('global struct init', L[0] === '10' && L[1] === '20', L.slice(0, 2).join());
  check('struct copies by value', L[2] === '10' && L[3] === '99', L.slice(2, 4).join());
  check('array of structs, nested member, float, bool', L[4] === '4' && L[5] === '0.50' && L[6] === '0', L.slice(4, 7).join());
  check('compound assignment on a member', L[7] === '6', L[7]);
  check('struct passed by value / by reference', L[8] === '30' && L[9] === '199' && L[10] === '10', L.slice(8, 11).join());
  check('struct returned from a function', L[11] === '56', L[11]);
  check('sizeof struct', L[12] === '4' && L[13] === '10' && L[14] === '20', L.slice(12, 15).join());
  check('float member arithmetic', L[15] === '0.25', L[15]);
  check('uninitialised struct member is 0', L[16] === '0', L[16]);
}
r = run('struct A { int a; }; void setup(){ A v; v.b = 1; } void loop(){}'); check('unknown member gives a clear error', /no member named 'b'/.test(r.err || ''), r.err);

// ---- enum / typedef
r = run(`enum State { IDLE, RUNNING = 5, DONE };
enum { A = 1 << 3, B };
typedef struct { byte r, g, b; } Color;
typedef unsigned int u16;
State s = RUNNING;
Color red = {255, 0, 0};
u16 big = 60000;
void setup() {
  Serial.begin(9600);
  Serial.println(s); Serial.println(DONE); Serial.println(A); Serial.println(B);
  s = DONE; switch (s) { case IDLE: Serial.println("idle"); break; case DONE: Serial.println("done"); break; }
  Serial.println(red.r); Serial.println(big);
  enum Mode { OFF, ON }; Mode m = ON; Serial.println(m == ON);
  State t = (State)1; Serial.println(t);
}
void loop() {}`);
check('enum / typedef program runs', !r.err, r.err);
if (!r.err) { const L = lines(r); check('enum values, auto-increment, shifts', L.slice(0, 4).join() === '5,6,8,9', L.slice(0, 4).join());
  check('enum in switch, typedef struct, typedef int', L[4] === 'done' && L[5] === '255' && L[6] === '60000', L.slice(4, 7).join());
  check('local enum + cast', L[7] === '1' && L[8] === '1', L.slice(7, 9).join()); }

// ---- EEPROM
const ee = new Uint8Array(1024).fill(255);
r = run(`struct Settings { int level; float gain; byte mode; };
void setup() {
  Serial.begin(9600);
  Serial.println(EEPROM.read(0));
  EEPROM.write(0, 42); EEPROM.update(1, 7); EEPROM[2] = 9; EEPROM[2] += 1;
  Serial.println(EEPROM.read(0)); Serial.println(EEPROM[1]); Serial.println(EEPROM[2]);
  Settings s = {1234, 2.5, 3}; EEPROM.put(10, s);
  Settings t = {0, 0, 0}; EEPROM.get(10, t);
  Serial.println(t.level); Serial.println(t.gain); Serial.println(t.mode);
  float f = 3.25; EEPROM.put(40, f); float g = 0; EEPROM.get(40, g); Serial.println(g);
  long n = 100000; EEPROM.put(50, n); long m = 0; EEPROM.get(50, m); Serial.println(m);
  Serial.println(EEPROM.length());
}
void loop() {}`, 200, it => { it.eeprom = ee; });
check('EEPROM program runs', !r.err, r.err);
if (!r.err) { const L = lines(r);
  check('fresh EEPROM reads 255', L[0] === '255', L[0]);
  check('write / update / [] / +=', L[1] === '42' && L[2] === '7' && L[3] === '10', L.slice(1, 4).join());
  check('put/get a struct (int, float, byte)', L[4] === '1234' && L[5] === '2.50' && L[6] === '3', L.slice(4, 7).join());
  check('put/get float and long', L[7] === '3.25' && L[8] === '100000', L.slice(7, 9).join());
  check('EEPROM.length() = 1024', L[9] === '1024', L[9]);
  check('data lands in the shared array (persistent)', ee[0] === 42 && ee[1] === 7, ee[0] + ',' + ee[1]);
  check('writes cost real time (3.3 ms per changed byte)', r.it.now > 20, r.it.now.toFixed(1)); }
r = run('void setup(){ EEPROM.read(2000); } void loop(){}'); check('EEPROM out of range error', /out of range/.test(r.err || ''), r.err);
r = run('void setup(){ Serial.begin(9600); EEPROM.update(5, 1); EEPROM.update(5, 1); Serial.println(millis()); } void loop(){}', 50, it => { it.eeprom = new Uint8Array(1024).fill(255); });
check('update() only pays for a changed byte', +r.out.trim() >= 3 && +r.out.trim() < 7, r.out);

// ---- interrupts
const isrSrc = `volatile int count = 0;
void onPulse() { count++; }
void setup() { Serial.begin(9600); pinMode(2, INPUT); attachInterrupt(digitalPinToInterrupt(2), onPulse, RISING); }
void loop() { delay(100); Serial.println(count); }`;
{
  const c = compile(isrSrc); check('interrupt sketch compiles', c.ok, c.error && c.error.message);
  const it = new Interpreter(c.program); let out = ''; it.onSerial = s => out += s;
  it.runUntil(1, 1e6);
  check('attachInterrupt registers the handler on INT0', !!it.isrs[0] && it.isrs[0].mode === 3);
  for (let k = 0; k < 3; k++) { it.raiseInterrupt(0); it.runUntil(2 + k * 2, 1e6); }
  it.runUntil(150, 1e6);
  check('handler ran once per raised interrupt, even during delay()', /^3\b/.test(out.trim()), JSON.stringify(out));
  it.intEnabled = false; it.raiseInterrupt(0); it.runUntil(160, 1e6); check('pending while interrupts are disabled', it.isrPend[0] === true);
  it.intEnabled = true; it.runUntil(170, 1e6); check('runs once they are re-enabled', it.isrPend[0] === false);
}
r = run('void h(int a){} void setup(){ attachInterrupt(0, h, RISING); } void loop(){}'); check('handler with parameters rejected', /no parameters/.test(r.err || ''), r.err);
r = run('void h(){} void setup(){ attachInterrupt(digitalPinToInterrupt(7), h, RISING); } void loop(){}'); check('pin without interrupt rejected', /D2 \(INT0\)/.test(r.err || ''), r.err);

// ---- shiftOut
r = run(`void setup() { pinMode(8, OUTPUT); pinMode(9, OUTPUT); shiftOut(8, 9, MSBFIRST, 0xA5); shiftOut(8, 9, LSBFIRST, 0x01); } void loop() {}`);
{
  const dw = r.ev.filter(e => e.kind === 'dw');
  check('shiftOut produces 16 clock pulses', dw.filter(e => e.pin === 9 && e.val === 1).length === 16, dw.length);
  const bits = []; let data = 0; for (const e of dw) { if (e.pin === 8) data = e.val; else if (e.val === 1) bits.push(data); }
  check('MSBFIRST 0xA5 sends 10100101', bits.slice(0, 8).join('') === '10100101', bits.slice(0, 8).join(''));
  check('LSBFIRST 0x01 sends 1 first then zeros', bits.slice(8).join('') === '10000000', bits.slice(8).join(''));
  const clk = dw.filter(e => e.pin === 9); check('clock edges are separated in time', clk[1].t > clk[0].t, '');
}

// ---- math
r = run(`void setup() { Serial.begin(9600);
  Serial.println(cbrt(27.0)); Serial.println(asin(1.0)); Serial.println(log10(1000.0)); Serial.println(hypot(3.0, 4.0));
  Serial.println(fmod(7.5, 2.0)); Serial.println(degrees(PI)); Serial.println(radians(180.0)); Serial.println(tanh(0.0));
  Serial.println(fmax(2.5, 7.5)); Serial.println(bit(4)); Serial.println(word(1, 2)); Serial.println(trunc(-2.7));
  Serial.println(INT_MAX); Serial.println(sgn(-4)); } void loop() {}`);
check('extra math runs', !r.err, r.err);
if (!r.err) check('extra math values', lines(r).join(' ') === '3.00 1.57 3.00 5.00 1.50 180.00 3.14 0.00 7.50 16 258 -2.00 32767 -1', lines(r).join(' '));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll round-2 language tests passed'); process.exit(fails ? 1 : 0);
