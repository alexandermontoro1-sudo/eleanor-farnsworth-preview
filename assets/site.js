/* Eleanor Farnsworth | shared behavior: reveals, nav state, mobile menu, listing filter, gallery lightbox. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.querySelector('.nav');

  /* --- Scroll reveals --- */
  var revealEls = document.querySelectorAll('.reveal:not(.is-in)');
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(revealEls, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    Array.prototype.forEach.call(revealEls, function (el) { io.observe(el); });
  }

  /* --- Hero scroll zoom ---
     Publishes scroll progress as a single custom property, --p (0 to 1), on the
     sticky stage. All the actual motion lives in CSS. Reads are latched to one
     rAF per frame so a fast scroll cannot queue up layout reads, and the whole
     thing is skipped under reduced motion or on small screens, where CSS pins
     the hero as a plain static image. */
  var heroOuter = document.querySelector('.hero-outer');
  var heroStage = document.querySelector('.hero-stage');
  if (heroOuter && heroStage) {
    var motionQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    var wideQ = window.matchMedia('(min-width: 901px)');
    var onScreen = false, running = false, io = null;

    var video = heroStage.querySelector('.hero-video');
    var videoReady = false, played = false, ticking = false;

    var smooth = function (t) { return t * t * (3 - 2 * t); };
    var ramp = function (x, a, b) {
      var t = (x - a) / (b - a);
      return smooth(t < 0 ? 0 : (t > 1 ? 1 : t));
    };

    /* The headline opens the film, steps aside while the camera travels, and
       returns over the staircase at the end with the buttons. One curve does all
       three: fade out early, stay away through the middle, come back at the end. */
    var publish = function () {
      if (!video || !video.duration) return;
      var v = video.currentTime / video.duration;
      var copy = Math.max(1 - ramp(v, 0.04, 0.30), ramp(v, 0.68, 0.90));
      heroStage.style.setProperty('--v', v.toFixed(4));
      heroStage.style.setProperty('--copy-o', copy.toFixed(3));
      // invisible buttons must not stay clickable
      heroStage.classList.toggle('copy-hidden', copy < 0.04);
    };

    /* timeupdate only fires a few times a second, which is too coarse for a fade,
       so the fade is driven per frame while the clip is actually running. */
    var tick = function () {
      publish();
      if (video && !video.paused && !video.ended) {
        requestAnimationFrame(tick);
      } else {
        ticking = false;
      }
    };
    var startTicking = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(tick);
    };
    /* The reader's first scroll starts the film. Nothing about the page is held
       back while it runs, so they can leave whenever they like. */
    var onScroll = function () {
      if (!videoReady) return;
      if (!played && onScreen) {
        played = true;
        var attempt = video.play();
        if (attempt && attempt.catch) attempt.catch(function () { played = false; });
      } else if (played && video.ended && window.scrollY < 4) {
        // returned to the top: rewind so the journey can run again
        played = false;
        video.pause();
        video.currentTime = 0;
        publish();
      }
    };

    // The clip is only fetched on screens that will actually play it, so phones
    // and reduced-motion visitors never pay for a video they will not see.
    var loadVideo = function () {
      if (!video || video.getAttribute('src')) return;
      // The video covers the full viewport width, so the source has to be at least
      // that wide or it gets upscaled and looks soft. The small file is 1280 wide,
      // so anything painting wider than that needs the 1920. Pixel ratio counts:
      // a 1440 retina viewport paints ~2880 device pixels.
      var painted = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
      var src = video.getAttribute(painted > 1280 ? 'data-src' : 'data-src-small');
      if (!src) return;
      video.addEventListener('loadedmetadata', function () {
        videoReady = true;
        heroStage.classList.add('video-on');
        publish();
      }, { once: true });
      video.addEventListener('play', startTicking);
      video.addEventListener('timeupdate', publish);
      video.addEventListener('ended', publish);
      video.addEventListener('error', function () {
        videoReady = false;
        heroStage.classList.remove('video-on');
      }, { once: true });
      video.setAttribute('src', src);
      video.load();
    };

    var start = function () {
      if (running) return;
      running = true;
      loadVideo();
      // Don't decode a clip nobody is looking at.
      io = new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (!video) return;
        if (!onScreen && !video.paused) {
          video.pause();
        } else if (onScreen && played && !video.ended && video.paused) {
          video.play().catch(function () {});
        }
      }, { threshold: 0.15 });
      io.observe(heroOuter);
      window.addEventListener('scroll', onScroll, { passive: true });
    };

    var stop = function () {
      if (!running) return;
      running = false;
      if (io) { io.disconnect(); io = null; }
      window.removeEventListener('scroll', onScroll);
      heroStage.style.removeProperty('--v');
      heroStage.style.removeProperty('--copy-o');
      heroStage.classList.remove('video-on', 'copy-hidden');
      if (video) video.pause();
      played = false;
    };

    // Re-evaluates live, so rotating a tablet or toggling the OS motion setting
    // switches between the pinned and the static hero without a reload.
    var sync = function () {
      if (wideQ.matches && !motionQ.matches) { start(); } else { stop(); }
    };
    if (motionQ.addEventListener) {
      motionQ.addEventListener('change', sync);
      wideQ.addEventListener('change', sync);
    }
    sync();
  }

  /* --- Nav goes solid past the hero --- */
  if (nav && !nav.classList.contains('always-solid')) {
    var sentinel = document.querySelector('[data-nav-sentinel]');
    if (sentinel && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        nav.classList.toggle('solid', !entries[0].isIntersecting);
      }, { rootMargin: '-72px 0px 0px 0px' }).observe(sentinel);
    } else {
      nav.classList.add('solid');
    }
  }

  /* --- Mobile menu --- */
  var burger = document.querySelector('.burger');
  if (burger && nav) {
    var panel = nav.querySelector('.nav-links');
    var setMenu = function (open) {
      nav.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', function () {
      setMenu(!nav.classList.contains('menu-open'));
    });
    if (panel) {
      panel.addEventListener('click', function (e) {
        if (e.target.closest('a')) setMenu(false);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && nav.classList.contains('menu-open')) setMenu(false);
    });
  }

  /* --- Saved properties ---
     Kept in localStorage. No account, no backend, nothing leaves the browser. */
  var SAVE_KEY = 'ef-saved';
  var readSaved = function () {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; }
    catch (e) { return []; }
  };
  var writeSaved = function (list) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch (e) {}
  };
  var syncSaveButtons = function () {
    var saved = readSaved();
    document.querySelectorAll('[data-save]').forEach(function (btn) {
      btn.setAttribute('aria-pressed',
        saved.indexOf(btn.getAttribute('data-save')) > -1 ? 'true' : 'false');
    });
  };
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-save]');
    if (!btn) return;
    e.preventDefault();
    var slug = btn.getAttribute('data-save');
    var saved = readSaved();
    var i = saved.indexOf(slug);
    if (i > -1) { saved.splice(i, 1); } else { saved.push(slug); }
    writeSaved(saved);
    syncSaveButtons();
    if (window.__efApplyFilters) window.__efApplyFilters();
  });
  syncSaveButtons();

  /* --- Listing filters, sort and saved view --- */
  var areaChips = document.querySelectorAll('.chip[data-filter]');
  var grid = document.querySelector('.listings-body .card-grid');
  if (areaChips.length && grid) {
    var cards = [].slice.call(grid.querySelectorAll('.lcard'));
    var out = document.querySelector('.filter-count');
    var sortSel = document.querySelector('[data-sort]');
    var savedBtn = document.querySelector('[data-show-saved]');
    var state = { area: 'all', priceMin: 0, priceMax: Infinity, beds: 0, savedOnly: false };

    var press = function (nodes, active) {
      nodes.forEach(function (n) { n.setAttribute('aria-pressed', n === active ? 'true' : 'false'); });
    };

    var applyFilters = function () {
      var saved = readSaved();
      var shown = 0;
      cards.forEach(function (c) {
        var price = +c.getAttribute('data-price');
        var beds = +c.getAttribute('data-beds');
        var ok = (state.area === 'all' || c.getAttribute('data-area') === state.area)
              && price >= state.priceMin && price <= state.priceMax
              && beds >= state.beds
              && (!state.savedOnly || saved.indexOf(c.getAttribute('data-slug')) > -1);
        c.hidden = !ok;
        if (ok) shown++;
      });
      if (out) {
        out.textContent = shown === 0
          ? (state.savedOnly ? 'Nothing saved yet' : 'No matches')
          : shown + (shown === 1 ? ' property' : ' properties');
      }
      if (state.syncClear) state.syncClear();
    };
    window.__efApplyFilters = applyFilters;

    var sortCards = function (mode) {
      var by = {
        'price-desc': function (a, b) { return b.p - a.p; },
        'price-asc':  function (a, b) { return a.p - b.p; },
        'beds-desc':  function (a, b) { return b.bd - a.bd || b.p - a.p; },
        'size-desc':  function (a, b) { return b.sq - a.sq || b.p - a.p; }
      }[mode];
      if (!by) return;
      cards.map(function (c) {
        return {
          el: c, p: +c.getAttribute('data-price'), bd: +c.getAttribute('data-beds'),
          sq: parseInt((c.querySelector('.lcard-specs') || {}).textContent
                       ? c.querySelector('.lcard-specs').textContent.replace(/[^0-9]/g, '').slice(-6)
                       : '0', 10) || 0
        };
      }).sort(by).forEach(function (o) { grid.appendChild(o.el); });
    };

    areaChips.forEach(function (ch) {
      ch.addEventListener('click', function () {
        state.area = ch.getAttribute('data-filter');
        press([].slice.call(areaChips), ch);
        applyFilters();
      });
    });

    /* Price range. Two native inputs share one track, which keeps keyboard and
       screen-reader support for free. Position maps to price on a squared curve:
       these listings run from $315k to $8.5M, so a linear track would crush three
       quarters of them into its first fifth. */
    var range = document.querySelector('[data-range]');
    if (range) {
      var rMin = +range.getAttribute('data-min');
      var rMax = +range.getAttribute('data-max');
      var lo = range.querySelector('[data-range-lo]');
      var hi = range.querySelector('[data-range-hi]');
      var fill = range.querySelector('[data-range-fill]');
      var outEl = range.querySelector('[data-range-out]');
      var hist = range.querySelector('[data-hist]');
      var STEPS = 1000;

      var posToPrice = function (pos) {
        var t = pos / STEPS;
        return rMin + (rMax - rMin) * t * t;
      };
      var priceToPos = function (price) {
        var t = Math.sqrt((price - rMin) / (rMax - rMin));
        return Math.max(0, Math.min(STEPS, Math.round(t * STEPS)));
      };
      var short = function (n) {
        if (n >= 1000000) return '$' + (n / 1000000).toFixed(n >= 10000000 ? 0 : 2)
          .replace(/\.?0+$/, '') + 'M';
        return '$' + Math.round(n / 1000) + 'k';
      };

      // distribution bars, drawn once from the real prices
      var BUCKETS = 26;
      var counts = new Array(BUCKETS).fill(0);
      cards.forEach(function (c) {
        var b = Math.min(BUCKETS - 1,
          Math.floor(priceToPos(+c.getAttribute('data-price')) / STEPS * BUCKETS));
        counts[b]++;
      });
      var peak = Math.max.apply(null, counts) || 1;
      hist.innerHTML = counts.map(function (n) {
        return '<i style="height:' + Math.round((n / peak) * 100) + '%"></i>';
      }).join('');
      var bars = [].slice.call(hist.querySelectorAll('i'));

      var paintRange = function () {
        var a = Math.min(+lo.value, +hi.value);
        var b = Math.max(+lo.value, +hi.value);
        state.priceMin = a === 0 ? 0 : posToPrice(a);
        state.priceMax = b === STEPS ? Infinity : posToPrice(b);
        fill.style.left = (a / STEPS * 100) + '%';
        fill.style.width = ((b - a) / STEPS * 100) + '%';
        outEl.textContent = (a === 0 && b === STEPS)
          ? 'Any price'
          : short(posToPrice(a)) + ' to ' + short(posToPrice(b));
        bars.forEach(function (bar, i) {
          var mid = (i + 0.5) / BUCKETS * STEPS;
          bar.classList.toggle('on', mid >= a && mid <= b);
        });
        applyFilters();
      };

      [lo, hi].forEach(function (input) {
        input.addEventListener('input', paintRange);
        // stop the handles crossing over each other
        input.addEventListener('change', function () {
          if (+lo.value > +hi.value) {
            var t = lo.value; lo.value = hi.value; hi.value = t;
            paintRange();
          }
        });
      });
      state.resetRange = function () {
        lo.value = 0; hi.value = STEPS; paintRange();
      };
      paintRange();
    }

    // Scoped to .seg-btn: the cards carry data-beds too, and an unscoped selector
    // would bind these handlers to every card on the page.
    var bedBtns = [].slice.call(document.querySelectorAll('.seg-btn[data-beds]'));
    bedBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-beds');
        state.beds = v === 'all' ? 0 : +v;
        press(bedBtns, btn);
        applyFilters();
      });
    });

    // Clear all appears only once something is actually filtering
    var clearBtn = document.querySelector('[data-clear]');
    var syncClear = function () {
      if (!clearBtn) return;
      var active = state.area !== 'all' || state.beds > 0 || state.savedOnly
        || state.priceMin > 0 || state.priceMax !== Infinity;
      clearBtn.hidden = !active;
    };
    state.syncClear = syncClear;
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.area = 'all'; state.beds = 0; state.savedOnly = false;
        press([].slice.call(areaChips), areaChips[0]);
        press(bedBtns, bedBtns[0]);
        if (savedBtn) savedBtn.setAttribute('aria-pressed', 'false');
        if (state.resetRange) { state.resetRange(); } else { applyFilters(); }
      });
    }

    if (savedBtn) {
      savedBtn.addEventListener('click', function () {
        state.savedOnly = !state.savedOnly;
        savedBtn.setAttribute('aria-pressed', state.savedOnly ? 'true' : 'false');
        applyFilters();
      });
    }
    if (sortSel) {
      sortSel.addEventListener('change', function () { sortCards(sortSel.value); });
      sortCards(sortSel.value);
    }
    applyFilters();
  }

  /* --- Sticky property bar --- */
  var stickyBar = document.querySelector('[data-sticky-bar]');
  if (stickyBar) {
    var anchor = document.querySelector('.ldetail-bar');
    var foot = document.querySelector('.site-foot');
    if (anchor && 'IntersectionObserver' in window) {
      var past = false, nearFoot = false;
      var render = function () { stickyBar.hidden = !(past && !nearFoot); };
      new IntersectionObserver(function (e) {
        past = e[0].boundingClientRect.top < 0;
        render();
      }, { threshold: 0 }).observe(anchor);
      if (foot) {
        new IntersectionObserver(function (e) {
          nearFoot = e[0].isIntersecting;
          render();
        }, { rootMargin: '0px 0px -40% 0px' }).observe(foot);
      }
    }
  }

  /* --- Share and print --- */
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('[data-share]');
    if (s) {
      var data = { title: s.getAttribute('data-share'), url: location.href };
      if (navigator.share) {
        navigator.share(data).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href).then(function () {
          var was = s.textContent;
          s.textContent = 'Link copied';
          setTimeout(function () { s.textContent = was; }, 1800);
        });
      }
    }
    if (e.target.closest && e.target.closest('[data-print]')) window.print();
  });

  /* --- Payment estimate --- */
  var calc = document.querySelector('[data-calc]');
  if (calc) {
    var price = +calc.getAttribute('data-price');
    var fmt = function (n) {
      return '$' + Math.round(n).toLocaleString('en-US');
    };
    var run = function () {
      var downPct = +calc.querySelector('[data-calc-down]').value || 0;
      var rate = +calc.querySelector('[data-calc-rate]').value || 0;
      var years = +calc.querySelector('[data-calc-years]').value || 30;
      var principal = price * (1 - downPct / 100);
      var r = rate / 100 / 12;
      var n = years * 12;
      // straight amortisation; a zero rate would divide by zero, so handle it
      var m = r > 0 ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n;
      calc.querySelector('[data-calc-out]').textContent = isFinite(m) ? fmt(m) + ' / month' : '—';
      calc.querySelector('[data-calc-sub]').textContent =
        fmt(price * downPct / 100) + ' down, ' + fmt(principal) + ' financed';
    };
    calc.querySelectorAll('input').forEach(function (i) {
      i.addEventListener('input', run);
    });
    run();
  }

  /* --- Contact form ---
     Posts to data-endpoint when one is configured in build.py. Until then it falls
     back to composing the message in the visitor's mail client. */
  var form = document.querySelector('form[data-mailto]');
  if (form) {
    var note = form.querySelector('.form-note');
    var say = function (msg) { if (note) note.textContent = msg; };
    var phone = form.getAttribute('data-phone') || '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      // A real endpoint posts in place; without one we fall back to the mail client.
      var endpoint = form.getAttribute('data-endpoint');
      if (endpoint) {
        var btn = form.querySelector('button[type=submit]');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending'; }
        fetch(endpoint, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form)
        }).then(function (res) {
          if (!res.ok) throw new Error(res.status);
          form.reset();
          say('Thank you. Your message has been sent and Eleanor will reply personally.');
          if (btn) btn.textContent = 'Sent';
        }).catch(function () {
          say('That did not send. Please call or text ' + phone + '.');
          if (btn) { btn.disabled = false; btn.textContent = 'Send to Eleanor'; }
        });
        return;
      }
      var get = function (n) {
        var el = form.elements[n];
        return el ? String(el.value).trim() : '';
      };
      var lines = [
        'Name: ' + get('name'),
        'Email: ' + get('email'),
        'Phone: ' + get('phone'),
        'Regarding: ' + get('intent'),
        '',
        get('message'),
        '',
        form.elements.sms && form.elements.sms.checked
          ? 'Consents to being contacted by text message.'
          : 'Prefers not to be contacted by text message.'
      ];
      var url = 'mailto:' + form.getAttribute('data-mailto') +
        '?subject=' + encodeURIComponent('Website enquiry: ' + (get('intent') || 'General')) +
        '&body=' + encodeURIComponent(lines.join('\n'));
      form.dispatchEvent(new CustomEvent('mailtocomposed', { detail: { url: url } }));
      window.location.href = url;
      var note = form.querySelector('.form-note');
      if (note) note.textContent = 'Your email client should now be open with this message ready to send.';
    });
  }

  /* --- Property map ---
     Pins are baked into the page at build time, so nothing is geocoded here and
     the map has no API key or third-party service to depend on beyond tiles. */
  var mapEl = document.getElementById('map');
  if (mapEl && window.L && Array.isArray(window.EF_PINS)) {
    var pins = window.EF_PINS;
    var map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    var STYLE = {
      active: { radius: 8, color: '#1F4634', weight: 2, fillColor: '#1F4634', fillOpacity: 0.9 },
      sold:   { radius: 7, color: '#4A554E', weight: 2, fillColor: '#FAF8F3', fillOpacity: 0.95 }
    };

    var esc = function (s) {
      return String(s).replace(/&(?![a-z]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    };

    var layers = [];
    pins.forEach(function (p) {
      var m;
      if (p.img) {
        // A photographed listing carries its own photograph as the marker.
        m = L.marker(p.ll, {
          icon: L.divIcon({
            className: 'photo-pin-wrap',
            // not lazy: a marker sitting outside the opening view would otherwise
            // render as an empty circle until the reader panned to it
            html: '<span class="photo-pin"><img src="' + p.img + '" alt=""></span>',
            iconSize: [46, 46],
            iconAnchor: [23, 23],
            popupAnchor: [0, -24]
          }),
          riseOnHover: true,
          title: p.a
        });
      } else {
        m = L.circleMarker(p.ll, STYLE[p.t]);
        m.on('mouseover', function () { this.setStyle({ weight: 4 }); });
        m.on('mouseout', function () { this.setStyle({ weight: 2 }); });
      }

      var body =
        '<span class="pin-addr">' + esc(p.a) + '</span>' +
        '<span class="pin-area">' + esc(p.n) + '</span>' +
        '<span class="pin-row">' +
          '<span class="pin-price">' + p.p + '</span>' +
          (p.t === 'sold' ? '<span class="pin-sold">Sold</span>' : '') +
          '<span class="pin-specs">' + p.s + '</span>' +
        '</span>';

      var html;
      if (p.u) {
        // The whole card is the link, so a click anywhere opens the property.
        // Listings that only exist on Compass open there, in a new tab.
        var attrs = p.ext ? ' target="_blank" rel="noopener"' : '';
        html = '<a class="pin-card" href="' + p.u + '"' + attrs + '>' +
                 (p.card ? '<span class="pin-photo"><img src="' + p.card + '" alt="' + esc(p.a) + '" loading="lazy">' +
                           (p.ph ? '<span class="pin-count">' + p.ph + ' photographs</span>' : '') +
                           '</span>' : '') +
                 '<span class="pin-body">' + body +
                   '<span class="pin-link">' +
                     (p.ext ? 'View on Compass' : 'View property') + '</span>' +
                 '</span>' +
               '</a>';
      } else {
        html = '<span class="pin-card pin-card-static"><span class="pin-body">' + body + '</span></span>';
      }

      m.bindPopup(html, { minWidth: p.card ? 260 : 200, maxWidth: 300, closeButton: true });
      layers.push({ type: p.t, marker: m });
      m.addTo(map);
    });

    var count = document.querySelector('.map-count');

    /* Fit to the New Orleans core, not to every pin. Bay St. Louis and Destrehan
       are an hour out, and including them in the fit zooms the city down to a dot,
       which hides the thing the map exists to show: how tightly her work clusters
       in the Garden District and Uptown. The outliers stay plotted; zoom out for them. */
    var CORE = L.latLng(29.941, -90.085);
    var isCore = function (l) { return CORE.distanceTo(l.marker.getLatLng()) < 12000; };

    var fit = function (shown) {
      if (!shown.length) return;
      var use = shown.filter(isCore);
      if (!use.length) use = shown;
      map.fitBounds(L.latLngBounds(use.map(function (l) { return l.marker.getLatLng(); })),
                    { padding: [50, 50], maxZoom: 15 });
    };

    var applyMap = function (key) {
      var shown = [];
      layers.forEach(function (l) {
        var on = key === 'all' || l.type === key;
        if (on) { l.marker.addTo(map); shown.push(l); } else { map.removeLayer(l.marker); }
      });
      if (count) count.textContent = shown.length + (shown.length === 1 ? ' property' : ' properties');
      document.querySelectorAll('.chip[data-map]').forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-map') === key ? 'true' : 'false');
      });
      fit(shown);
    };

    document.querySelectorAll('.chip[data-map]').forEach(function (c) {
      c.addEventListener('click', function () { applyMap(c.getAttribute('data-map')); });
    });
    applyMap('all');

    // Scroll wheel would otherwise swallow the page scroll; click to enable.
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });
  }

  /* --- Gallery lightbox --- */
  var figures = document.querySelectorAll('.gallery figure');
  if (!figures.length) return;

  var sources = Array.prototype.map.call(figures, function (f) {
    var img = f.querySelector('img');
    return { src: img.getAttribute('data-full') || img.src, alt: img.alt || '' };
  });

  var lb = null, lbImg = null, counter = null, index = 0, lastFocus = null;

  function build() {
    if (lb) return;
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.innerHTML =
      '<button class="lb-close" aria-label="Close photo viewer">&times;</button>' +
      '<button class="lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<img src="' + sources[0].src + '" alt="">' +
      '<button class="lb-next" aria-label="Next photo">&#8250;</button>' +
      '<div class="lb-counter"></div>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('img');
    counter = lb.querySelector('.lb-counter');
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(index - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(index + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === lbImg) close(); });
  }

  function show(i) {
    index = (i + sources.length) % sources.length;
    lbImg.src = sources[index].src;
    lbImg.alt = sources[index].alt;
    counter.textContent = (index + 1) + ' / ' + sources.length;
  }
  function open(i) {
    lastFocus = document.activeElement;
    build();
    show(i);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  Array.prototype.forEach.call(figures, function (f, i) {
    f.setAttribute('tabindex', '0');
    f.setAttribute('role', 'button');
    f.setAttribute('aria-label', 'View photo ' + (i + 1) + ' of ' + sources.length);
    f.addEventListener('click', function () { open(i); });
    f.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (!lb || !lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
})();
