// Pulse — generative background music + timer chime (Web Audio, no audio files).
// window.PulseAudio: tracks, play(id), stop(), setVolume(0..1), isPlaying(), beep()
(function () {
  var ctx = null, out = null, cur = null, vol = 0.5, brownBuf = null, whiteBuf = null;
  var TRACKS = [
    { id: "lofi", name: "Lo-fi beats" },
    { id: "ambient", name: "Ambient pads" },
    { id: "musicbox", name: "Music box" },
    { id: "rain", name: "Rain" }
  ];

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      out = ctx.createGain();
      out.gain.value = 1;
      out.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function buf(kind) {
    if (kind === "brown" && brownBuf) return brownBuf;
    if (kind === "white" && whiteBuf) return whiteBuf;
    var c = ac(), b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < d.length; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    if (kind === "brown") brownBuf = b; else whiteBuf = b;
    return b;
  }
  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function tone(t, dest, freq, dur, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain();
    var a = o.attack || 0.01, r = o.release || 0.3, peak = o.gain || 0.2, hold = Math.max(a, dur);
    osc.type = o.type || "sine";
    osc.frequency.value = freq;
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + r);
    osc.connect(g); g.connect(o.to || dest);
    osc.start(t); osc.stop(t + hold + r + 0.05);
  }
  function burst(t, dest, kind, filterType, freq, gain, dur) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf(kind); f.type = filterType; f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function kick(t, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.32);
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var LOFI_CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  var AMB_CHORDS = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 53, 57, 59]];
  var PENTA = [72, 74, 76, 79, 81, 84, 86, 88];

  var DEFS = {
    lofi: {
      cutoff: 2200,
      step: function (t, s, d) {
        var bar = Math.floor(s / 8) % 4, pos = s % 8, ch = LOFI_CHORDS[bar];
        if (pos === 0) {
          ch.forEach(function (n) { tone(t, d, mtof(n), 2.6, { type: "triangle", gain: 0.045, attack: 0.03, release: 1.2 }); });
          tone(t, d, mtof(ch[0] - 12), 0.8, { gain: 0.16, release: 0.4 });
        }
        if (pos === 0 || pos === 3) kick(t, d);
        if (pos === 4) burst(t, d, "white", "bandpass", 1800, 0.08, 0.14);
        if (pos % 2 === 1) burst(t, d, "white", "highpass", 7000, 0.035, 0.04);
        if ((pos === 2 || pos === 6) && Math.random() < 0.6) tone(t, d, mtof(pick(ch) + 12), 0.25, { gain: 0.05, release: 0.5 });
        return s % 2 === 0 ? 0.46 : 0.37;
      }
    },
    ambient: {
      cutoff: 900,
      step: function (t, s, d) {
        var ch = AMB_CHORDS[s % 4];
        ch.forEach(function (n) {
          tone(t, d, mtof(n), 3.2, { type: "sawtooth", gain: 0.016, attack: 1.8, release: 3, detune: -7 });
          tone(t, d, mtof(n), 3.2, { type: "sawtooth", gain: 0.016, attack: 1.8, release: 3, detune: 7 });
        });
        if (Math.random() < 0.6) tone(t + 1 + Math.random() * 2, d, mtof(pick(ch) + 24), 0.05, { gain: 0.04, release: 2.5 });
        return 4.5;
      }
    },
    musicbox: {
      cutoff: 6000,
      step: function (t, s, d) {
        if (Math.random() < 0.7) {
          var n = pick(PENTA);
          tone(t, d, mtof(n), 0.02, { gain: 0.1, attack: 0.005, release: 1.2 });
          tone(t, d, mtof(n + 12), 0.02, { gain: 0.025, attack: 0.005, release: 0.8 });
        }
        if (s % 8 === 0) tone(t, d, mtof([48, 45, 41, 43][Math.floor(s / 8) % 4]), 0.1, { gain: 0.09, release: 2.5 });
        return 0.36;
      }
    },
    rain: {
      cutoff: 8000,
      start: function (d) {
        var nodes = [];
        [["brown", "lowpass", 1100, 0.35], ["white", "highpass", 3500, 0.04]].forEach(function (p) {
          var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
          s.buffer = buf(p[0]); s.loop = true; f.type = p[1]; f.frequency.value = p[2]; g.gain.value = p[3];
          s.connect(f); f.connect(g); g.connect(d); s.start();
          nodes.push(s);
        });
        return nodes;
      },
      step: function (t, s, d) {
        if (Math.random() < 0.25) tone(t, d, 2000 + Math.random() * 2500, 0.005, { gain: 0.015, attack: 0.002, release: 0.05 });
        return 0.15;
      }
    }
  };

  function stop() {
    if (!cur) return;
    var c = cur; cur = null;
    clearInterval(c.timer);
    var now = ctx.currentTime;
    c.master.gain.cancelScheduledValues(now);
    c.master.gain.setValueAtTime(c.master.gain.value, now);
    c.master.gain.linearRampToValueAtTime(0.0001, now + 0.5);
    setTimeout(function () {
      (c.loops || []).forEach(function (n) { try { n.stop(); } catch (e) {} });
      try { c.master.disconnect(); } catch (e) {}
    }, 700);
  }

  function play(id) {
    var def = DEFS[id];
    if (!def) return;
    stop();
    ac();
    var master = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = def.cutoff;
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(vol * 0.8, ctx.currentTime + 1.2);
    lp.connect(master); master.connect(out);
    var c = { id: id, master: master, dest: lp, next: ctx.currentTime + 0.1, step: 0 };
    c.loops = def.start ? def.start(lp) : [];
    c.timer = setInterval(function () {
      while (c.next < ctx.currentTime + 0.3) { c.next += def.step(c.next, c.step++, c.dest); }
    }, 60);
    cur = c;
  }

  function setVolume(v) {
    vol = Math.max(0, Math.min(1, v));
    if (cur) cur.master.gain.setTargetAtTime(vol * 0.8, ctx.currentTime, 0.1);
  }

  function beep() {
    ac();
    var t = ctx.currentTime + 0.05;
    [[79, 0], [72, 0.3], [79, 0.9], [72, 1.2], [79, 1.8], [84, 2.1]].forEach(function (p, i) {
      tone(t + p[1], out, mtof(p[0]), 0.2, { gain: 0.15, attack: 0.02, release: i === 5 ? 1.4 : 0.6 });
    });
  }

  function celebrate() {
    ac();
    var t = ctx.currentTime + 0.05, g = ctx.createGain();
    g.gain.value = 0.9; g.connect(out);
    [72, 76, 79, 84].forEach(function (n, i) {
      tone(t + i * 0.11, g, mtof(n), 0.12, { type: "triangle", gain: 0.13, attack: 0.01, release: 0.35 });
    });
    [72, 76, 79, 84, 88].forEach(function (n) {
      tone(t + 0.48, g, mtof(n), 0.5, { type: "triangle", gain: 0.06, attack: 0.02, release: 1.4 });
    });
    for (var i = 0; i < 9; i++) {
      tone(t + 0.55 + i * 0.07 + Math.random() * 0.04, g, mtof(pick([91, 93, 96, 98, 100])), 0.02, { gain: 0.035, attack: 0.004, release: 0.4 });
    }
  }

  window.PulseAudio = {
    tracks: TRACKS, play: play, stop: stop, setVolume: setVolume, beep: beep, celebrate: celebrate,
    isPlaying: function () { return !!cur; }
  };
})();
