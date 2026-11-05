/* ---------------------------------------------------------------
   Smart21 ElectroLab — circuit solver
   Modified nodal analysis (MNA) with Newton iteration for diodes /
   LEDs / transistors and backward-Euler companion models for
   capacitors. Every source is a Norton equivalent, so the unknowns
   are only node voltages (no branch currents needed).
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const VT = 0.025852;      // thermal voltage at ~300 K
  const GMIN = 1e-9;        // tiny conductance to ground on every node

  // SPICE-style junction voltage limiting: stops exp() from blowing up.
  function pnjlim(vnew, vold, vt, vcrit) {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
      if (vold > 0) {
        const arg = 1 + (vnew - vold) / vt;
        vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
      } else {
        vnew = vt * Math.log(vnew / vt);
      }
    }
    return vnew;
  }

  // Gaussian elimination with partial pivoting. A (n*n) and z (n) are destroyed;
  // the solution is left in z. Returns false if the matrix is singular.
  function solveLinear(A, z, n) {
    for (let col = 0; col < n; col++) {
      let p = col, max = Math.abs(A[col * n + col]);
      for (let r = col + 1; r < n; r++) {
        const v = Math.abs(A[r * n + col]);
        if (v > max) { max = v; p = r; }
      }
      if (max < 1e-18) return false;
      if (p !== col) {
        for (let c = col; c < n; c++) { const t = A[col * n + c]; A[col * n + c] = A[p * n + c]; A[p * n + c] = t; }
        const t = z[col]; z[col] = z[p]; z[p] = t;
      }
      const piv = A[col * n + col];
      for (let r = col + 1; r < n; r++) {
        const f = A[r * n + col] / piv;
        if (f === 0) continue;
        for (let c = col; c < n; c++) A[r * n + c] -= f * A[col * n + c];
        z[r] -= f * z[col];
      }
    }
    for (let r = n - 1; r >= 0; r--) {
      let s = z[r];
      for (let c = r + 1; c < n; c++) s -= A[r * n + c] * z[c];
      z[r] = s / A[r * n + r];
    }
    return true;
  }

  function stampG(A, N, a, b, g) {
    if (a > 0) A[(a - 1) * N + (a - 1)] += g;
    if (b > 0) A[(b - 1) * N + (b - 1)] += g;
    if (a > 0 && b > 0) { A[(a - 1) * N + (b - 1)] -= g; A[(b - 1) * N + (a - 1)] -= g; }
  }
  function stampI(z, a, b, i) {      // current i flows into node a and out of node b
    if (a > 0) z[a - 1] += i;
    if (b > 0) z[b - 1] -= i;
  }
  function add(A, N, r, c, val) { if (r > 0 && c > 0) A[(r - 1) * N + (c - 1)] += val; }

  /*  Element types
      R  {a,b,r}                      resistor (also closed/open switches)
      V  {a,b,v,rs,en}                Norton voltage source, + at a. en:false = disconnected
      D  {a,b,is,n}                   diode / LED (anode a, cathode b). off:true = burnt (open)
      C  {a,b,c,v0}                   capacitor
      L  {a,b,l,i0}                   inductor (backward-Euler companion model)
      Q  {c,b,e,is,bf,br,pol}         bipolar transistor (Ebers-Moll). pol: 1 = NPN (default), -1 = PNP
      M  {d,g,s,kp,vth,lam,pol}       MOSFET, level-1 square law. pol: 1 = N-channel, -1 = P-channel
      OA {p,n,o,vp,vn,gain,ro}        op-amp: output follows gain·(V+ − V−), clamped smoothly between the
                                      supply pins vn..vp (node indices; may be 0 = ground)
      D with bv                       Zener: also conducts in reverse above breakdown voltage bv
  */
  class Sim {
    constructor(nl) {
      this.nodeCount = nl.nodeCount;
      this.els = nl.elements;
      this.v = new Float64Array(this.nodeCount);
      const N = Math.max(this.nodeCount - 1, 0);
      this.A = new Float64Array(N * N);
      this.z = new Float64Array(N);
      this.W = new Float64Array(N * N);
      this.x = new Float64Array(N);
      this.time = 0;
      this.iterations = 0;
      this.converged = true;
      this.nonlinear = false;
      this.hasL = false;
      for (const e of this.els) {
        if (e.type === 'D') { e.nvt = (e.n || 1) * VT; e.vcrit = e.nvt * Math.log(e.nvt / (Math.SQRT2 * e.is)); e.vlin = 0; this.nonlinear = true; }
        if (e.type === 'Q') { e.vcrit = VT * Math.log(VT / (Math.SQRT2 * e.is)); e.vbeL = 0; e.vbcL = 0; e.pol = e.pol || 1; this.nonlinear = true; }
        if (e.type === 'D' && e.bv) { e.isz = e.isz || 1e-12; e.nvtz = VT; e.vcritz = VT * Math.log(VT / (Math.SQRT2 * e.isz)); e.wlin = 0; }
        if (e.type === 'M') { e.vgsL = 0; e.vdsL = 0; this.nonlinear = true; }
        if (e.type === 'OA') { e.gain = e.gain || 1e5; e.ro = e.ro || 50; e.mlo = e.mlo === undefined ? 0.05 : e.mlo; e.mhi = e.mhi === undefined ? 1.5 : e.mhi; e.region = 'lin'; e.state = 'lin'; this.nonlinear = true; }
        if (e.type === 'L' || e.type === 'T') this.hasL = true;
        if (e.type === 'T') { e.k = e.k === undefined ? 0.99 : e.k; e.ip1 = e.i01 || 0; e.ip2 = e.i02 || 0; e.m = e.k * Math.sqrt(e.l1 * e.l2); }
        if (e.type === 'C') e.vprev = e.v0 || 0;
        if (e.type === 'L') e.iprev = e.i0 || 0;
        e.vd = 0; e.i = 0;
      }
      if (this.hasL) this.nonlinear = true;     // the spike limiter below needs Newton iteration
    }

    step(dt) {
      const N = this.nodeCount - 1;
      if (N <= 0) { this.time += dt; for (const e of this.els) if (e.type === 'V') { e.vd = 0; e.i = e.en === false ? 0 : e.v / e.rs; } return; }
      const { A, z, W, x, v, els } = this;
      let converged = false, it = 0;
      for (; it < 100; it++) {
        A.fill(0); z.fill(0);
        for (let i = 0; i < N; i++) A[i * N + i] += GMIN;
        let limited = false, flipped = false;

        for (let k = 0; k < els.length; k++) {
          const e = els[k];
          switch (e.type) {
            case 'R': stampG(A, N, e.a, e.b, 1 / Math.max(e.r, 1e-6)); break;
            case 'V': {
              if (e.en === false) break;
              const g = 1 / e.rs;
              stampG(A, N, e.a, e.b, g);
              stampI(z, e.a, e.b, e.v * g);
              break;
            }
            case 'C': {
              const g = e.c / dt;
              stampG(A, N, e.a, e.b, g);
              stampI(z, e.a, e.b, g * e.vprev);
              break;
            }
            case 'L': {
              const g = dt / e.l;
              stampG(A, N, e.a, e.b, g);
              stampI(z, e.a, e.b, -e.iprev);
              break;
            }
            case 'T': {                       // two magnetically coupled windings (a transformer): [v1 v2] = Lm/dt · ([i1 i2] − previous)
              e.m = e.k * Math.sqrt(e.l1 * e.l2);
              const det = e.l1 * e.l2 - e.m * e.m, g11 = dt * e.l2 / det, g22 = dt * e.l1 / det, g12 = -dt * e.m / det;
              add(A, N, e.a1, e.a1, g11); add(A, N, e.a1, e.b1, -g11); add(A, N, e.b1, e.a1, -g11); add(A, N, e.b1, e.b1, g11);
              add(A, N, e.a2, e.a2, g22); add(A, N, e.a2, e.b2, -g22); add(A, N, e.b2, e.a2, -g22); add(A, N, e.b2, e.b2, g22);
              add(A, N, e.a1, e.a2, g12); add(A, N, e.a1, e.b2, -g12); add(A, N, e.b1, e.a2, -g12); add(A, N, e.b1, e.b2, g12);
              add(A, N, e.a2, e.a1, g12); add(A, N, e.a2, e.b1, -g12); add(A, N, e.b2, e.a1, -g12); add(A, N, e.b2, e.b1, g12);
              stampI(z, e.a1, e.b1, -e.ip1); stampI(z, e.a2, e.b2, -e.ip2);
              break;
            }
            case 'D': {
              if (e.off) break;
              const vd = v[e.a] - v[e.b];
              const vl = pnjlim(vd, e.vlin, e.nvt, e.vcrit);
              if (Math.abs(vl - vd) > 1e-9) limited = true;
              e.vlin = vl;
              const ex = Math.exp(Math.min(vl / e.nvt, 80));
              let id = e.is * (ex - 1);
              const g = e.is * ex / e.nvt + 1e-12;
              stampG(A, N, e.a, e.b, g);
              stampI(z, e.a, e.b, -(id - g * vl));
              if (e.bv) {                           // Zener: reverse breakdown, current k → a once vd < −bv
                const w = -(vd + e.bv);
                const wl = pnjlim(w, e.wlin, e.nvtz, e.vcritz);
                if (Math.abs(wl - w) > 1e-9) limited = true;
                e.wlin = wl;
                const h0 = e.isz * Math.exp(Math.min(wl / e.nvtz, 80));
                const gz = h0 / e.nvtz + 1e-12;
                stampG(A, N, e.a, e.b, gz);
                stampI(z, e.a, e.b, -(-h0 + gz * (e.bv + wl)));
                id -= h0;
              }
              e.iNow = id;
              break;
            }
            case 'Q': {
              const sg = e.pol;
              const vbe0 = sg * (v[e.b] - v[e.e]), vbc0 = sg * (v[e.b] - v[e.c]);
              const vbe = pnjlim(vbe0, e.vbeL, VT, e.vcrit);
              const vbc = pnjlim(vbc0, e.vbcL, VT, e.vcrit);
              if (Math.abs(vbe - vbe0) > 1e-9 || Math.abs(vbc - vbc0) > 1e-9) limited = true;
              e.vbeL = vbe; e.vbcL = vbc;
              const exE = Math.exp(Math.min(vbe / VT, 80)), exC = Math.exp(Math.min(vbc / VT, 80));
              const ibe = e.is * (exE - 1), ibc = e.is * (exC - 1);
              const gbe = e.is * exE / VT + 1e-12, gbc = e.is * exC / VT + 1e-12;
              const Ic = ibe - ibc - ibc / e.br;
              const Ib = ibe / e.bf + ibc / e.br;
              e.ic = sg * Ic; e.ib = sg * Ib;          // real currents into the collector / base pins
              const a1 = gbe, b1 = -gbc * (1 + 1 / e.br);
              const c1 = gbe / e.bf, d1 = gbc / e.br;
              const icEq = sg * (Ic - a1 * vbe - b1 * vbc);
              const ibEq = sg * (Ib - c1 * vbe - d1 * vbc);
              add(A, N, e.c, e.b, a1 + b1); add(A, N, e.c, e.e, -a1); add(A, N, e.c, e.c, -b1);
              if (e.c > 0) z[e.c - 1] -= icEq;
              add(A, N, e.b, e.b, c1 + d1); add(A, N, e.b, e.e, -c1); add(A, N, e.b, e.c, -d1);
              if (e.b > 0) z[e.b - 1] -= ibEq;
              add(A, N, e.e, e.b, -(a1 + b1 + c1 + d1)); add(A, N, e.e, e.e, a1 + c1); add(A, N, e.e, e.c, b1 + d1);
              if (e.e > 0) z[e.e - 1] += icEq + ibEq;
              break;
            }
            case 'M': {
              const sg = e.pol;
              const vg = sg * v[e.g], vdd = sg * v[e.d], vss = sg * v[e.s];
              let vgs = vg - vss, vds = vdd - vss;
              if (Math.abs(vgs - e.vgsL) > 0.7) { vgs = e.vgsL + Math.sign(vgs - e.vgsL) * 0.7; limited = true; }
              if (Math.abs(vds - e.vdsL) > 4) { vds = e.vdsL + Math.sign(vds - e.vdsL) * 4; limited = true; }
              e.vgsL = vgs; e.vdsL = vds;
              // the channel is symmetric: with vds < 0 the roles of drain and source swap (odd extension)
              const rev = vds < 0, vg2 = rev ? vgs - vds : vgs, vd2 = rev ? -vds : vds;
              const vov = vg2 - e.vth, lam = e.lam || 0.02;
              let id = 0, gm = 0, gds = 0;
              if (vov > 0) {
                const cl = 1 + lam * vd2;
                if (vd2 < vov) {
                  const core = vov * vd2 - 0.5 * vd2 * vd2;
                  id = e.kp * core * cl; gm = e.kp * vd2 * cl; gds = e.kp * (vov - vd2) * cl + e.kp * core * lam;
                } else {
                  id = 0.5 * e.kp * vov * vov * cl; gm = e.kp * vov * cl; gds = 0.5 * e.kp * vov * vov * lam;
                }
              }
              if (rev) { id = -id; const g2 = gm + gds; gm = -gm; gds = g2; }
              gds += 1e-9;
              e.idNow = sg * id; e.on = vov > 0;
              stampG(A, N, e.d, e.s, gds);
              add(A, N, e.d, e.g, gm); add(A, N, e.d, e.s, -gm); add(A, N, e.s, e.g, -gm); add(A, N, e.s, e.s, gm);
              stampI(z, e.d, e.s, -(sg * (id - gm * vgs - gds * vds)));
              break;
            }
            case 'OA': {
              const vp = v[e.p] - v[e.n], vsup = v[e.vp] - v[e.vn];
              if (vsup < 2.4) {                         // unpowered: the output floats
                e.state = 'off'; e.region = 'off'; stampG(A, N, e.o, e.vn, 1e-6); e.iOut = 0; break;
              }
              stampG(A, N, e.vp, e.vn, 1 / 20000);      // quiescent supply current
              const lo = v[e.vn] + e.mlo, hi = v[e.vp] - e.mhi, tlin = e.gain * vp;
              // Piecewise-linear iteration. A saturated output can only leave through the linear region (so
              // feedback circuits settle); if the linear solution then points back to the rail we left, the
              // original direction wins (that is what makes a Schmitt trigger flip instead of chatter).
              const cand = tlin > hi ? 'H' : tlin < lo ? 'L' : 'lin';
              let region = e.region;
              if (e.region === 'off') { region = 'lin'; e.pend = null; }
              else if (e.region === 'lin') {
                region = cand;
                if (e.pend && cand !== 'lin' && cand !== e.pend) region = e.pend;
                e.pend = null;
              } else if (cand === e.region || (e.region === 'H' && tlin > hi - 1e-3) || (e.region === 'L' && tlin < lo + 1e-3)) region = e.region;
              else { region = 'lin'; e.pend = cand === 'lin' ? null : cand; }
              if (region !== e.region) { e.region = region; flipped = true; }
              const g = 1 / e.ro;
              if (region === 'lin') {
                const gm = e.gain * g;
                add(A, N, e.o, e.o, g); add(A, N, e.o, e.p, -gm); add(A, N, e.o, e.n, gm);
              } else {
                add(A, N, e.o, e.o, g); if (e.o > 0) z[e.o - 1] += (region === 'H' ? hi : lo) * g;
              }
              e.state = region;
              break;
            }
          }
        }

        if (this.hasL) {                                // inductive kick limiter: a node cannot run away beyond ±120 V
          for (let i = 0; i < N; i++) { const vi = v[i + 1]; if (vi > 120) { A[i * N + i] += 0.1; z[i] += 12; } else if (vi < -120) { A[i * N + i] += 0.1; z[i] -= 12; } }
        }
        W.set(A); x.set(z);
        if (!solveLinear(W, x, N)) break;
        let ok = true;
        for (let i = 0; i < N; i++) {
          const nv = x[i];
          if (!isFinite(nv)) { ok = false; break; }
          if (Math.abs(nv - v[i + 1]) > 1e-6 + 1e-4 * Math.abs(nv)) ok = false;
          v[i + 1] = nv;
        }
        if (!this.nonlinear) { converged = true; it++; break; }
        if (ok && !limited && !flipped) { converged = true; it++; break; }
      }
      this.iterations = it;
      this.converged = converged;
      this.time += dt;

      // Post-process: element voltages / currents, capacitor state.
      for (let k = 0; k < els.length; k++) {
        const e = els[k];
        switch (e.type) {
          case 'R': e.vd = v[e.a] - v[e.b]; e.i = e.vd / Math.max(e.r, 1e-6); break;
          case 'V': e.vd = v[e.a] - v[e.b]; e.i = e.en === false ? 0 : (e.v - e.vd) / e.rs; break;
          case 'C': e.vd = v[e.a] - v[e.b]; e.i = (e.c / dt) * (e.vd - e.vprev); e.vprev = e.vd; break;
          case 'L': e.vd = v[e.a] - v[e.b]; e.i = (dt / e.l) * e.vd + e.iprev; e.iprev = e.i; break;
          case 'T': {
            const det = e.l1 * e.l2 - e.m * e.m, g11 = dt * e.l2 / det, g22 = dt * e.l1 / det, g12 = -dt * e.m / det;
            e.v1 = v[e.a1] - v[e.b1]; e.v2 = v[e.a2] - v[e.b2];
            e.i1 = e.ip1 + g11 * e.v1 + g12 * e.v2; e.i2 = e.ip2 + g12 * e.v1 + g22 * e.v2; e.ip1 = e.i1; e.ip2 = e.i2; e.i = e.i1; e.vd = e.v1; break;
          }
          case 'D': e.vd = v[e.a] - v[e.b]; e.i = e.off ? 0 : e.iNow; break;
          case 'Q': e.vbe = v[e.b] - v[e.e]; e.vce = v[e.c] - v[e.e]; e.i = e.ic || 0; break;
          case 'M': e.vgs = v[e.g] - v[e.s]; e.vds = v[e.d] - v[e.s]; e.i = e.idNow || 0; break;
          case 'OA': {
            e.vd = v[e.p] - v[e.n]; e.vo = v[e.o];
            if (e.state === 'lin') e.i = (e.gain * e.vd - v[e.o]) / e.ro;
            else if (e.state === 'H') e.i = (v[e.vp] - e.mhi - v[e.o]) / e.ro;
            else if (e.state === 'L') e.i = (v[e.vn] + e.mlo - v[e.o]) / e.ro;
            else e.i = 0;
            break;
          }
        }
      }
    }
  }

  const api = { Sim, VT, pnjlim, solveLinear };
  root.S21 = root.S21 || {};
  root.S21.Solver = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
