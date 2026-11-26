/* NOIR ATELIER — Digital Runway engine
   Independent background + model layers. New look: background wipes in
   right→left while the model glides in from the right; the old model exits left. */
(function () {
  "use strict";

  var LOOKS = [
    { mega: "NOIR",     kicker: "Look 01 — Streetwear",  title: "Noir Street",
      desc: "Premium black streetwear — oversized hoodie, cargo trouser, monochrome sneakers.",
      bg: "linear-gradient(160deg,#2c2c30 0%,#17171a 78%)", theme: "light" },
    { mega: "DENIM",    kicker: "Look 02 — Denim",       title: "Indigo Denim",
      desc: "Head-to-toe indigo — fitted denim jacket, straight-leg jean, clean white sneakers.",
      bg: "linear-gradient(160deg,#31457c 0%,#1d2a52 78%)", theme: "light" },
    { mega: "BORDEAUX", kicker: "Look 03 — Tailoring",   title: "Bordeaux Tailoring",
      desc: "Wine-red tailoring — single-breasted burgundy suit, polished tan leather shoes.",
      bg: "linear-gradient(160deg,#671f30 0%,#3c1220 78%)", theme: "light" },
    { mega: "IVORY",    kicker: "Look 04 — Luxury",      title: "Ivory Luxe",
      desc: "Quiet luxury in ivory — double-breasted long coat over a silk dress, nude heels.",
      bg: "linear-gradient(160deg,#f4efe4 0%,#e3dac4 78%)", theme: "dark" },
    { mega: "OLIVE",    kicker: "Look 05 — Casualwear",  title: "Olive Field",
      desc: "Earth-tone casualwear — olive utility jacket and chinos with suede sneakers.",
      bg: "linear-gradient(160deg,#666e49 0%,#41482c 78%)", theme: "light" },
    { mega: "LINEN",    kicker: "Look 06 — Linen",       title: "Sand Linen",
      desc: "Breezy sandstone linen — unstructured blazer, pleated trouser, leather loafers.",
      bg: "linear-gradient(160deg,#d3ba93 0%,#b09468 78%)", theme: "dark" }
  ];
  var N = LOOKS.length;
  var CYCLE_MS = 4500;          // time per look, transition included
  var TRANS_MS = 1250;          // glide / wipe duration
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined";

  // Image sources: data-URIs from models.js when present, else local files.
  var SRC = [];
  for (var i = 0; i < N; i++) {
    SRC.push((window.MODEL_SRC && window.MODEL_SRC[i]) || ("assets/look" + (i + 1) + ".png"));
  }
  // Preload everything so transitions never wait on the network.
  SRC.forEach(function (s) { var im = new Image(); im.src = s; });

  var $ = function (id) { return document.getElementById(id); };
  var bgBase = $("bgBase"), bgWipe = $("bgWipe"), mega = $("megaWord");
  var wraps = [$("modelA"), $("modelB")], imgs = [$("imgA"), $("imgB")];
  var capKicker = $("capKicker"), capTitle = $("capTitle"), capDesc = $("capDesc");
  var counterNow = $("counterNow"), progressFill = $("progressFill");
  var playBtn = $("playBtn"), dotsBox = $("dots");

  var current = 0, front = 0;         // wraps[front] is on stage
  var playing = !reduced, userPaused = false, hoverPaused = false, busy = false;
  var progressTween = null;

  /* ---------- dots ---------- */
  var dots = [];
  LOOKS.forEach(function (_, idx) {
    var b = document.createElement("button");
    b.className = "dot" + (idx === 0 ? " active" : "");
    b.setAttribute("aria-label", "Go to look " + (idx + 1));
    b.addEventListener("click", function () { goTo(idx, idx > current ? 1 : -1); restartCycle(); });
    dotsBox.appendChild(b); dots.push(b);
  });

  /* ---------- animation helpers (GSAP, WAAPI fallback) ---------- */
  function setX(el, vw) { el.style.transform = "translateX(calc(-50% + " + vw + "vw))"; }
  function anim(el, from, to, dur, ease, done) {
    if (hasGsap) {
      var props = { duration: dur / 1000, ease: ease || "power3.inOut", onComplete: done };
      if (to.x !== undefined) props.x = "calc(-50% + " + to.x + "vw)";
      if (to.opacity !== undefined) props.opacity = to.opacity;
      if (from) {
        var f = {};
        if (from.x !== undefined) f.x = "calc(-50% + " + from.x + "vw)";
        if (from.opacity !== undefined) f.opacity = from.opacity;
        gsap.fromTo(el, f, props);
      } else gsap.to(el, props);
    } else if (el.animate) {
      var kf = [];
      var a = {}, b = {};
      if (from && from.x !== undefined) a.transform = "translateX(calc(-50% + " + from.x + "vw))";
      if (to.x !== undefined) b.transform = "translateX(calc(-50% + " + to.x + "vw))";
      if (from && from.opacity !== undefined) a.opacity = from.opacity;
      if (to.opacity !== undefined) b.opacity = to.opacity;
      kf.push(a, b);
      var an = el.animate(kf, { duration: dur, easing: "cubic-bezier(.65,0,.25,1)", fill: "forwards" });
      if (done) an.onfinish = done;
    } else { if (done) done(); }
  }
  function wipeBg(dir, dur, done) {
    var fromClip = dir > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
    bgWipe.style.clipPath = fromClip;
    if (hasGsap) {
      gsap.to(bgWipe, { clipPath: "inset(0 0% 0 0%)", duration: dur / 1000, ease: "power3.inOut", onComplete: done });
    } else if (bgWipe.animate) {
      var an = bgWipe.animate([{ clipPath: fromClip }, { clipPath: "inset(0 0% 0 0%)" }],
        { duration: dur, easing: "cubic-bezier(.65,0,.25,1)", fill: "forwards" });
      an.onfinish = done;
    } else if (done) done();
  }

  /* ---------- look application ---------- */
  function applyText(idx) {
    var L = LOOKS[idx];
    mega.textContent = L.mega;
    capKicker.textContent = L.kicker;
    capTitle.textContent = L.title;
    capDesc.textContent = L.desc;
    counterNow.textContent = ("0" + (idx + 1)).slice(-2);
    document.body.setAttribute("data-theme", L.theme);
    dots.forEach(function (d, j) { d.classList.toggle("active", j === idx); });
  }

  function goTo(idx, dir) {
    if (busy || idx === current) return;
    busy = true;
    dir = dir || 1;
    var dur = reduced ? 1 : TRANS_MS;
    var back = 1 - front;
    var inWrap = wraps[back], outWrap = wraps[front];
    var inImg = imgs[back];

    inImg.src = SRC[idx];
    inImg.alt = LOOKS[idx].title + " — model";
    bgWipe.style.background = LOOKS[idx].bg;

    // Stage the incoming model off-screen on the entry side.
    inWrap.style.zIndex = 6; outWrap.style.zIndex = 5;
    inWrap.style.opacity = "0";
    setX(inWrap, dir > 0 ? 62 : -62);
    // Force reflow so the WAAPI/GSAP start state is honoured.
    void inWrap.offsetWidth;

    wipeBg(dir, dur);
    anim(outWrap, null, { x: dir > 0 ? -62 : 62, opacity: 0 }, dur * 0.92);
    anim(inWrap, { x: dir > 0 ? 62 : -62, opacity: 0 }, { x: 0, opacity: 1 }, dur, "power3.out");

    // Typography crossfade.
    var capEls = [mega, capKicker, capTitle, capDesc];
    if (hasGsap && !reduced) {
      gsap.to(capEls, { opacity: 0, y: 14, duration: 0.28, ease: "power2.in", onComplete: function () {
        applyText(idx);
        gsap.fromTo(capEls, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.05 });
      }});
    } else { applyText(idx); }

    setTimeout(function () {
      bgBase.style.background = LOOKS[idx].bg;
      bgWipe.style.clipPath = "inset(0 0 0 100%)";
      outWrap.style.opacity = "0";
      front = back; current = idx; busy = false;
    }, dur + 40);
  }

  /* ---------- autoplay ---------- */
  function startCycle() {
    stopCycle();
    if (!playing) { progressFill.style.width = "0%"; return; }
    if (hasGsap) {
      var state = { t: 0 };
      progressTween = gsap.to(state, { t: 1, duration: CYCLE_MS / 1000, ease: "none",
        onUpdate: function () { progressFill.style.width = (state.t * 100) + "%"; },
        onComplete: function () { goTo((current + 1) % N, 1); startCycle(); } });
    } else {
      progressFill.style.transition = "width " + CYCLE_MS + "ms linear";
      progressFill.style.width = "0%";
      void progressFill.offsetWidth;
      progressFill.style.width = "100%";
      progressTween = setTimeout(function () { goTo((current + 1) % N, 1); startCycle(); }, CYCLE_MS);
    }
  }
  function stopCycle() {
    if (!progressTween) return;
    if (hasGsap && progressTween.kill) progressTween.kill(); else clearTimeout(progressTween);
    progressTween = null;
    progressFill.style.transition = "none";
  }
  function pauseCycle() {
    if (!progressTween) return;
    if (hasGsap && progressTween.pause) progressTween.pause();
    else { /* timeout fallback: simply stop; resume restarts the cycle */ stopCycle(); }
  }
  function resumeCycle() {
    if (!playing) return;
    if (hasGsap && progressTween && progressTween.resume) progressTween.resume();
    else if (!progressTween) startCycle();
  }
  function restartCycle() { if (playing) startCycle(); else progressFill.style.width = "0%"; }
  function effectivePlay() { playing = !userPaused && !hoverPaused && !reduced; }

  /* ---------- controls ---------- */
  function setPlayIcon() { playBtn.textContent = (userPaused || reduced) ? "▶" : "❚❚"; playBtn.setAttribute("aria-label", (userPaused || reduced) ? "Play autoplay" : "Pause autoplay"); }
  playBtn.addEventListener("click", function () {
    userPaused = !userPaused;
    if (reduced && userPaused === false) { /* reduced-motion: allow manual play via instant swaps */ }
    effectivePlay(); setPlayIcon();
    if (playing) startCycle(); else { pauseCycle(); }
  });
  $("nextBtn").addEventListener("click", function () { goTo((current + 1) % N, 1); restartCycle(); });
  $("prevBtn").addEventListener("click", function () { goTo((current - 1 + N) % N, -1); restartCycle(); });
  $("shopBtn").addEventListener("click", function (e) { e.preventDefault(); });

  var stage = $("stage");
  stage.addEventListener("mouseenter", function () { hoverPaused = true; effectivePlay(); if (!playing) pauseCycle(); });
  stage.addEventListener("mouseleave", function () { hoverPaused = false; effectivePlay(); if (playing) resumeCycle(); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { goTo((current + 1) % N, 1); restartCycle(); }
    else if (e.key === "ArrowLeft") { goTo((current - 1 + N) % N, -1); restartCycle(); }
    else if (e.key === " ") { e.preventDefault(); playBtn.click(); }
  });

  var touchX = null;
  stage.addEventListener("touchstart", function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) < 42) return;
    if (dx < 0) { goTo((current + 1) % N, 1); } else { goTo((current - 1 + N) % N, -1); }
    restartCycle();
  }, { passive: true });

  /* ---------- init ---------- */
  bgBase.style.background = LOOKS[0].bg;
  imgs[0].src = SRC[0];
  imgs[0].alt = LOOKS[0].title + " — model";
  wraps[0].style.opacity = "1"; setX(wraps[0], 0);
  wraps[1].style.opacity = "0"; setX(wraps[1], 62);
  applyText(0);
  setPlayIcon();
  if (playing) startCycle();
})();
