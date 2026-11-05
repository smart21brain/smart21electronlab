const { compile, Interpreter } = require('../src/js/arduino/interp.js');
let fails = 0;
function check(name, cond, extra) { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '   ' + extra : '')); }
function run(src, ms, opts) {
  const c = compile(src);
  if (!c.ok) return { err: c.error.message + ' (line ' + c.error.line + ')' };
  const it = new Interpreter(c.program);
  let out = ''; it.onSerial = s => out += s; const warns = []; it.onWarn = m => warns.push(m);
  it.runUntil(ms, 5e6);
  return { it, out, warns, err: it.error ? it.error.message : null, ev: it.events };
}

// Blink: toggles every 500 ms
let r = run(`const int LED = 13;
void setup(){ pinMode(LED, OUTPUT); }
void loop(){ digitalWrite(LED, HIGH); delay(500); digitalWrite(LED, LOW); delay(500); }`, 2100);
const writes = r.ev.filter(e => e.kind === 'dw');
check('blink toggles 4+ times in 2.1 s', writes.length >= 4, 'writes=' + writes.length);
check('blink timing ~500 ms', Math.abs(writes[1].t - writes[0].t - 500) < 1, 'dt=' + (writes[1].t - writes[0].t).toFixed(3));

// Serial + math + int vs float semantics
r = run(`void setup(){ Serial.begin(9600);
 int a = 7; float b = 7; 
 Serial.println(a/2); Serial.println(b/2); Serial.println(7/2.0); Serial.println(10 % 3);
 int big = 32767; big++; Serial.println(big);
 unsigned long u = 0; u--; Serial.println(u);
 byte x = 300; Serial.println(x);
 Serial.print("sum="); Serial.println(2 + 3);
 char c = 'A'; Serial.println(c); Serial.println((int)c);
 Serial.println(3.14159, 3); Serial.println(255, HEX); Serial.println(5, BIN);
 Serial.println(map(512, 0, 1023, 0, 255));
}
void loop(){}`, 10);
check('serial output', r.out === '3\n3.50\n3.50\n1\n-32768\n4294967295\n44\nsum=5\nA\n65\n3.142\nFF\n101\n127\n', JSON.stringify(r.out) + ' ' + (r.err || ''));

// functions, recursion, arrays, loops, switch, #define, ternary
r = run(`#define N 5
int sq(int v){ return v*v; }
int fact(int n){ if(n<=1) return 1; return n*fact(n-1); }
int arr[N] = {1,2,3,4,5};
void setup(){ Serial.begin(9600);
  int s = 0; for(int i=0;i<N;i++){ s += sq(arr[i]); } Serial.println(s);
  Serial.println(fact(5));
  int k = 2; switch(k){ case 1: Serial.println("one"); break; case 2: Serial.println("two"); case 3: Serial.println("three"); break; default: Serial.println("def"); }
  Serial.println(s > 50 ? "big" : "small");
  int j = 0; while(true){ j++; if(j==3) continue; if(j>5) break; Serial.print(j); Serial.print(' '); } Serial.println();
  Serial.println(sizeof(arr)/sizeof(arr[0]));
  String t = "Hi"; t += " there"; Serial.println(t.length()); Serial.println(t);
}
void loop(){}`, 10);
check('functions / arrays / control flow', r.out === '55\n120\ntwo\nthree\nbig\n1 2 4 5 \n5\n8\nHi there\n', JSON.stringify(r.out) + ' ' + (r.err || ''));

// digitalRead/analogRead from injected voltages, button
r = run(`int pot = A0; void setup(){ Serial.begin(9600); pinMode(2, INPUT_PULLUP); }
void loop(){ int v = analogRead(pot); Serial.println(v); if(digitalRead(2)==LOW){ Serial.println("PRESSED"); } delay(100); }`, 0);
{
  const c = compile(`int pot = A0; void setup(){ Serial.begin(9600); pinMode(2, INPUT_PULLUP); }
void loop(){ int v = analogRead(pot); Serial.println(v); if(digitalRead(2)==LOW){ Serial.println("PRESSED"); } delay(100); }`);
  const it = new Interpreter(c.program); let out = ''; it.onSerial = s => out += s;
  it.pinVolts[14] = 2.5; it.pinVolts[2] = 5; it.runUntil(50, 1e6);
  it.pinVolts[2] = 0; it.runUntil(250, 1e6);
  check('analogRead(2.5V)=512 and button read', /^512\n/.test(out) && out.includes('PRESSED'), JSON.stringify(out));
}

// PWM / tone events and warnings
r = run(`void setup(){ analogWrite(9, 128); analogWrite(4, 100); digitalWrite(7, HIGH); tone(8, 440); Serial.println("x"); }
void loop(){}`, 10);
check('pwm event + warnings', r.ev.some(e => e.kind === 'pwm' && e.pin === 9 && e.val === 128) && r.ev.some(e => e.kind === 'tone' && e.val === 440) && r.warns.length >= 3, r.warns.join(' | '));

// error cases
r = run(`void setup(){ int x = 5 }\nvoid loop(){}`, 1);
check('missing semicolon reported with line', /expected ';'/.test(r.err) && /line 1/.test(r.err), r.err);
r = run(`void setup(){ foo(); }\nvoid loop(){}`, 5);
check('unknown function error', /not declared/.test(r.err), r.err);
r = run(`void setup(){ int a[3]; a[5]=1; }\nvoid loop(){}`, 5);
check('array bounds error', /out of range/.test(r.err), r.err);
r = run(`void setup(){}`, 1);
check('missing loop()', /loop/.test(r.err), r.err);
// infinite busy loop does not hang
const t0 = Date.now(); r = run(`void setup(){ while(true){} } void loop(){}`, 100);
check('busy loop returns quickly', Date.now() - t0 < 500, (Date.now() - t0) + ' ms');
// millis-based blink without delay
r = run(`unsigned long last=0; int st=0; void setup(){ pinMode(13,OUTPUT);} 
void loop(){ if(millis()-last>=200){ last=millis(); st=!st; digitalWrite(13,st);} }`, 1000, {});
check('millis() blink without delay', r.ev.filter(e => e.kind === 'dw').length >= 4, 'writes=' + r.ev.filter(e => e.kind === 'dw').length);
// Servo + LiquidCrystal library objects
{
  const src = `#include <Servo.h>
#include <LiquidCrystal.h>
Servo s; Servo arm[2];
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void setup() { s.attach(9); s.write(45); arm[1].attach(10); arm[1].write(170);
  lcd.begin(16, 2); lcd.print("Hi "); lcd.print(42); lcd.setCursor(0, 1); lcd.print(3.14159, 2); lcd.print('!'); Serial.begin(9600); Serial.println(s.read()); }
void loop() {}`;
  const r = run(src, 20);
  const sv = r.ev.filter(e => e.kind === 'servo');
  check('servo events (attach+write)', sv.length >= 3 && sv.some(e => e.pin === 9 && e.val === 45) && sv.some(e => e.pin === 10 && e.val === 170), JSON.stringify(sv.map(e => e.pin + ':' + e.val)));
  const lcd = r.it.libObjects.find(o => o.__lib === 'LCD');
  check('LCD text buffer', lcd && lcd.lines[0] === 'Hi 42           ' && lcd.lines[1].startsWith('3.14!'), lcd && JSON.stringify(lcd.lines));
  check('servo.read()', r.out === '45\n', JSON.stringify(r.out) + (r.err || ''));
  const bad = run('LiquidCrystal lcd(1,2,3);\nvoid setup(){}\nvoid loop(){}', 5);
  check('LiquidCrystal with wrong pin count is explained', /6 pins/.test(bad.err || ''), bad.err);
  const early = run('Servo s; void setup(){ s.write(90); } void loop(){}', 5);
  check('write before attach gives a warning', early.warns.some(w => /attach/.test(w)), early.warns.join('|'));
}
// pulseIn with a simulated sensor oracle + timeout behaviour
{
  const src = `long measure() { digitalWrite(9, LOW); delayMicroseconds(2); digitalWrite(9, HIGH); delayMicroseconds(10); digitalWrite(9, LOW); return pulseIn(8, HIGH, 30000); }
void setup() { Serial.begin(9600); pinMode(9, OUTPUT); pinMode(8, INPUT); Serial.println(measure()); }
void loop() {}`;
  const c = compile(src); const it = new Interpreter(c.program); let out = ''; it.onSerial = s => out += s;
  it.oracle = (pin, level, now) => { const pu = it.pinPulse[9]; if (pin !== 8 || !pu || pu.fall - pu.rise < 0.008) return null; return { start: pu.fall + 0.46, end: pu.fall + 0.46 + 29 * 0.0583 * 2 }; };
  it.runUntil(100, 1e6);
  check('pulseIn returns the sensor echo width (µs)', Math.abs(+out - 3381) < 5, JSON.stringify(out));
  const c2 = compile(src); const it2 = new Interpreter(c2.program); let o2 = ''; it2.onSerial = s => o2 += s; it2.runUntil(100, 1e6);
  check('pulseIn with no sensor times out after 30 ms and returns 0', o2 === '0\n' && it2.now >= 30, JSON.stringify(o2) + ' now=' + it2.now.toFixed(1));
  check('trigger pulse width is tracked per pin', it.pinPulse[9] && it.pinPulse[9].fall - it.pinPulse[9].rise > 0.009 && it.pinPulse[9].fall - it.pinPulse[9].rise < 0.02);
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll interpreter tests passed');
process.exit(fails ? 1 : 0);
