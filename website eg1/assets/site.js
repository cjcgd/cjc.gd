/* Typing effect + glitch-on-load images + gallery counter / keyboard nav */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────── typing ─────────
     Every element marked [data-type] has its text nodes blanked, then typed back in.
     data-type="fast" types quicker (used for the side navigation).               */
  function textNodes(root) {
    var out = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.trim().length) out.push(n);
    }
    return out;
  }

  function typeAll() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll("[data-type]"));
    if (reduce || !blocks.length) {
      blocks.forEach(function (el) { el.style.visibility = "visible"; });
      return;
    }

    var jobs = blocks.map(function (el) {
      var nodes = textNodes(el).map(function (n) {
        var full = n.nodeValue;
        n.nodeValue = "";
        return { node: n, full: full };
      });
      var total = nodes.reduce(function (s, x) { return s + x.full.length; }, 0);
      return { el: el, nodes: nodes, total: total, typed: 0, fast: el.getAttribute("data-type") === "fast" };
    });

    // keep layout stable while text is blank
    blocks.forEach(function (el) { el.style.visibility = "visible"; });

    var start = performance.now();
    var delay = 120; // small pause before typing begins

    function frame(now) {
      var t = now - start - delay;
      var running = false;

      jobs.forEach(function (job) {
        if (job.typed >= job.total) { job.el.classList.remove("typing-cursor"); return; }
        running = true;
        if (t < 0) return;

        // long blocks type faster so every block finishes in a similar time
        var cps = job.fast ? 160 : Math.max(55, job.total / 1.6);
        var target = Math.min(job.total, Math.floor((t / 1000) * cps) + 1);
        if (target === job.typed) return;
        job.typed = target;

        var remaining = target;
        job.nodes.forEach(function (p) {
          var take = Math.max(0, Math.min(p.full.length, remaining));
          p.node.nodeValue = p.full.slice(0, take);
          remaining -= take;
        });
        job.el.classList.add("typing-cursor");
      });

      if (running) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  /* ───────── glitch ───────── */
  function revealImage(img) {
    if (img.classList.contains("is-visible")) return;
    img.classList.add("is-visible");
    if (!reduce) {
      img.classList.add("glitch");
      img.addEventListener("animationend", function () { img.classList.remove("glitch"); }, { once: true });
    }
  }

  function setupGallery() {
    var gallery = document.querySelector(".gallery");
    if (!gallery) return;

    var figures = Array.prototype.slice.call(gallery.querySelectorAll("figure"));
    var imgs = Array.prototype.slice.call(gallery.querySelectorAll("img"));
    var ui = document.querySelector(".panel-ui");
    var counter = document.querySelector(".panel-ui .count");

    // glitch each image when it is first seen (first image: as soon as it has loaded)
    var seen = new WeakSet();
    function whenReady(img, cb) {
      if (img.complete && img.naturalWidth) cb();
      else {
        img.addEventListener("load", cb, { once: true });
        img.addEventListener("error", function () { img.classList.add("is-visible"); }, { once: true });
      }
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var img = e.target.querySelector("img");
          if (!img || seen.has(img)) return;
          seen.add(img);
          whenReady(img, function () { revealImage(img); });
        });
      }, { root: gallery, threshold: 0.35 });
      figures.forEach(function (f) { io.observe(f); });
    } else {
      imgs.forEach(function (img) { whenReady(img, function () { revealImage(img); }); });
    }

    // counter + hint
    var total = figures.length;
    if (ui) ui.hidden = total < 2;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function update() {
      if (!counter || total < 2) return;
      var idx = Math.round(gallery.scrollTop / gallery.clientHeight) + 1;
      counter.textContent = pad(Math.min(idx, total)) + " / " + pad(total);
      var hint = ui.querySelector(".hint");
      if (hint) hint.style.visibility = idx >= total ? "hidden" : "visible";
    }
    gallery.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    // keyboard: up/down/page keys scroll one image at a time
    gallery.setAttribute("tabindex", "0");
    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var dir = 0;
      if (e.key === "ArrowDown" || e.key === "PageDown") dir = 1;
      if (e.key === "ArrowUp" || e.key === "PageUp") dir = -1;
      if (!dir) return;
      e.preventDefault();
      gallery.scrollBy({ top: dir * gallery.clientHeight, behavior: "smooth" });
    });
  }

  /* ───────── snake (snake.html only) ───────── */
  function setupSnake() {
    var canvas = document.getElementById("snake");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var size = 16, cols = canvas.width / size, rows = canvas.height / size;
    var snake, dir, next, food, score, timer, over;
    var scoreEl = document.getElementById("score");

    function place() {
      do { food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }; }
      while (snake.some(function (s) { return s.x === food.x && s.y === food.y; }));
    }
    function reset() {
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      dir = next = { x: 1, y: 0 }; score = 0; over = false;
      scoreEl.textContent = "score: 0 — use arrow keys / WASD";
      place(); clearInterval(timer); timer = setInterval(tick, 95); draw();
    }
    function tick() {
      dir = next;
      var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows ||
          snake.some(function (s) { return s.x === head.x && s.y === head.y; })) {
        over = true; clearInterval(timer);
        scoreEl.textContent = "game over — score: " + score + " — press space to restart";
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; scoreEl.textContent = "score: " + score; place(); }
      else snake.pop();
      draw();
    }
    function draw() {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f2f2ee";
      snake.forEach(function (s) { ctx.fillRect(s.x * size + 1, s.y * size + 1, size - 2, size - 2); });
      ctx.strokeStyle = "#f2f2ee"; ctx.strokeRect(food.x * size + 3, food.y * size + 3, size - 6, size - 6);
    }
    document.addEventListener("keydown", function (e) {
      var k = e.key.toLowerCase();
      var map = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
      if (k === " " && over) { reset(); e.preventDefault(); return; }
      if (map[k]) {
        e.preventDefault();
        var v = { x: map[k][0], y: map[k][1] };
        if (v.x !== -dir.x || v.y !== -dir.y) next = v;
      }
    });
    reset();
  }

  document.addEventListener("DOMContentLoaded", function () {
    typeAll();
    setupGallery();
    setupSnake();
  });
})();
