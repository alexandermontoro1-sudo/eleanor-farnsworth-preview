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
      var src = video.getAttribute(window.innerWidth > 1280 ? 'data-src' : 'data-src-small');
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

  /* --- Listing filter --- */
  var chips = document.querySelectorAll('.chip[data-filter]');
  if (chips.length) {
    var cards = document.querySelectorAll('[data-area]');
    var out = document.querySelector('.filter-count');
    var apply = function (key) {
      var shown = 0;
      Array.prototype.forEach.call(cards, function (c) {
        var match = key === 'all' || c.getAttribute('data-area') === key;
        c.hidden = !match;
        if (match) shown++;
      });
      if (out) out.textContent = shown + (shown === 1 ? ' property' : ' properties');
      Array.prototype.forEach.call(chips, function (ch) {
        ch.setAttribute('aria-pressed', ch.getAttribute('data-filter') === key ? 'true' : 'false');
      });
    };
    Array.prototype.forEach.call(chips, function (ch) {
      ch.addEventListener('click', function () { apply(ch.getAttribute('data-filter')); });
    });
    apply('all');
  }

  /* --- Contact form ---
     No backend on a static build, so this composes the message into the visitor's
     mail client addressed to Eleanor. Swap for Formspree or Netlify Forms at launch. */
  var form = document.querySelector('form[data-mailto]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
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
