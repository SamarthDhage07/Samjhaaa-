/**
 * Surplus Relay - Creative Front-End Engine
 * Handles frame preloading, 700vh scroll-driven story with dual-layer seam split,
 * interactive simulation map, horizontal scroll, 3D tilt, magnetic buttons, and custom cursor.
 */
(function () {
  'use strict';

  const TOTAL_FRAMES = 120;
  const SEAM_START = 0.62;
  const SEAM_GLOW_END = 0.68;
  const SEAM_OPEN_END = 1.0;

  let frames = [];
  let isMobile = window.innerWidth < 768;
  let targetProgress = 0;
  let smoothedProgress = 0;
  let isPinnedActive = true;
  let lenisInstance = null;
  let mouseX = 0, mouseY = 0;
  let stageMouseX = 0, stageMouseY = 0;
  let hasScrolledOnce = false;
  let rafId = null;

  // Power2 in/out easing curve for natural seam separation
  function easePower2InOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // 1. Frame Loader Screen
  function preloadFrames(onInitialReady) {
    const loader = document.getElementById('story-loader');
    const fill = document.getElementById('loader-fill');
    const text = document.getElementById('loader-text');
    const folder = isMobile ? '/frames/mobile' : '/frames/desktop';
    let loadedCount = 0;
    let initialTriggered = false;

    frames = new Array(TOTAL_FRAMES);

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const num = String(i).padStart(3, '0');
      img.src = `${folder}/f_${num}.jpg`;

      img.onload = () => {
        loadedCount++;
        const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = `Preloading story frames: ${pct}%`;

        // Once first 10 frames are ready, reveal landing stage immediately
        if (loadedCount >= 10 && !initialTriggered) {
          initialTriggered = true;
          if (loader) loader.classList.add('done');
          onInitialReady();
        }
      };

      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= 10 && !initialTriggered) {
          initialTriggered = true;
          if (loader) loader.classList.add('done');
          onInitialReady();
        }
      };

      frames[i - 1] = img;
    }
  }

  // 2. Dual Canvas Cover Draw
  function drawCover(ctx, img, width, height) {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = width / height;
    let renderW, renderH, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      renderW = width;
      renderH = width / imgRatio;
      offsetX = 0;
      offsetY = (height - renderH) / 2;
    } else {
      renderH = height;
      renderW = height * imgRatio;
      offsetX = (width - renderW) / 2;
      offsetY = 0;
    }

    // Centering adjustments on mobile to keep truck centered
    if (isMobile) {
      offsetX = (width - renderW) * 0.52;
    }

    // Desktop mouse parallax shift (6 to 10px)
    if (!isMobile) {
      offsetX += stageMouseX * 8;
      offsetY += stageMouseY * 8;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  }

  let storyCompleted = false;

  // 3. Scroll & Animation Loop
  function initStoryStage() {
    const scrollWrapper = document.getElementById('story-scroll-wrapper');
    const stage = document.getElementById('story-stage');
    const canvasLeft = document.getElementById('seam-canvas-left');
    const canvasRight = document.getElementById('seam-canvas-right');
    const layerLeft = document.querySelector('.seam-layer-left');
    const layerRight = document.querySelector('.seam-layer-right');
    const centerLine = document.getElementById('seam-center-line');
    const progressFill = document.getElementById('story-progress-fill');
    const scrollHint = document.getElementById('scroll-hint');
    const hero = document.getElementById('hero-section');
    const closingCard = document.getElementById('story-closing-card');

    if (!scrollWrapper || !stage || !canvasLeft || !canvasRight || !layerLeft || !layerRight) return;

    const ctxL = canvasLeft.getContext('2d');
    const ctxR = canvasRight.getContext('2d');
    let lastDrawnFrame = -1;

    function resizeCanvases() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvasLeft.width = w * dpr;
      canvasLeft.height = h * dpr;
      canvasRight.width = w * dpr;
      canvasRight.height = h * dpr;
      ctxL.scale(dpr, dpr);
      ctxR.scale(dpr, dpr);
      lastDrawnFrame = -1;
    }
    resizeCanvases();
    window.addEventListener('resize', () => {
      isMobile = window.innerWidth < 768;
      resizeCanvases();
    }, { passive: true });

    // Desktop subtle cursor parallax
    window.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      stageMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      stageMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    // Calculate scroll progress through 700vh wrapper
    function onScroll() {
      if (storyCompleted) return;
      const rect = scrollWrapper.getBoundingClientRect();
      const scrollDist = rect.height - window.innerHeight;
      if (scrollDist <= 0) return;

      const raw = -rect.top / scrollDist;
      targetProgress = Math.min(1, Math.max(0, raw));

      if (targetProgress > 0.01 && !hasScrolledOnce) {
        hasScrolledOnce = true;
        if (scrollHint) scrollHint.style.opacity = '0';
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    function completeStory() {
      if (storyCompleted) return;
      storyCompleted = true;
      try {
        sessionStorage.setItem('sr_story_done', '1');
      } catch (e) {}

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('scroll', onScroll);

      if (scrollWrapper) {
        scrollWrapper.classList.add('completed');
        scrollWrapper.style.display = 'none';
      }

      if (hero) {
        hero.style.transform = 'none';
        hero.style.opacity = '1';
        hero.classList.add('settled');
      }

      window.scrollTo(0, 0);
      if (lenisInstance) {
        lenisInstance.resize();
        lenisInstance.scrollTo(0, { immediate: true });
      }
    }

    // Expose completeStory globally so nav clicks can dismiss the story immediately
    window.completeStoryStage = completeStory;

    // Captions array
    const captions = [
      { start: 0.00, end: 0.20, el: document.getElementById('caption-1') },
      { start: 0.20, end: 0.45, el: document.getElementById('caption-2') },
      { start: 0.45, end: 0.62, el: document.getElementById('caption-3') }
    ];

    function renderLoop() {
      if (storyCompleted) return;

      // Clean responsive non-sticky scrub
      const lerpFactor = 0.22;
      smoothedProgress += (targetProgress - smoothedProgress) * lerpFactor;

      // One-way lock: once animation is done, hero opens permanently and story is closed
      if (smoothedProgress >= 0.96 && targetProgress >= 0.95) {
        completeStory();
        return;
      }

      // Frame selection based on scroll progress
      const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.floor(smoothedProgress * TOTAL_FRAMES)));
      const img = frames[frameIdx];

      const stageW = window.innerWidth;
      const stageH = window.innerHeight;

      // Only redraw canvas when frame actually changes (eliminates 95% of GPU load and flutter)
      if (frameIdx !== lastDrawnFrame && img && img.complete) {
        lastDrawnFrame = frameIdx;
        ctxL.clearRect(0, 0, stageW, stageH);
        ctxR.clearRect(0, 0, stageW, stageH);
        drawCover(ctxL, img, stageW, stageH);
        drawCover(ctxR, img, stageW, stageH);
      }

      // Progress bar along bottom edge
      if (progressFill) {
        progressFill.style.width = (smoothedProgress * 100).toFixed(2) + '%';
      }

      // Story Captions (0 to 62%)
      captions.forEach(c => {
        if (!c.el) return;
        if (smoothedProgress >= c.start && smoothedProgress < c.end) {
          c.el.classList.add('active');
        } else {
          c.el.classList.remove('active');
        }
      });

      // Seam Timeline Logic
      // 0 to 62%: closed
      // 62 to 68%: center hairline glows
      // 68 to 100%: horizontal seam split from 0 to 100vw
      let halfGap = 0;
      let lineOpacity = 0;

      if (smoothedProgress < SEAM_START) {
        halfGap = 0;
        lineOpacity = 0;
        if (centerLine) centerLine.style.opacity = '0';
        if (closingCard) closingCard.classList.remove('active');
      } else if (smoothedProgress < SEAM_GLOW_END) {
        halfGap = 0;
        const glowPhase = (smoothedProgress - SEAM_START) / (SEAM_GLOW_END - SEAM_START);
        lineOpacity = glowPhase;
        if (centerLine) {
          centerLine.style.opacity = String(0.3 + glowPhase * 0.7);
        }
        if (closingCard) closingCard.classList.remove('active');
      } else {
        // Seam widening
        if (centerLine) centerLine.style.opacity = '0';
        const openProgress = (smoothedProgress - SEAM_GLOW_END) / (SEAM_OPEN_END - SEAM_GLOW_END);
        const eased = easePower2InOut(Math.min(1, Math.max(0, openProgress)));
        halfGap = eased * (stageW * 0.52);
        lineOpacity = 1;

        // Closing caption appears at opening and fades before wide
        if (closingCard) {
          if (openProgress > 0.02 && openProgress < 0.42) {
            closingCard.classList.add('active');
          } else {
            closingCard.classList.remove('active');
          }
        }

        // Hero settling effect: scale 1.05 to 1, y 24px to 0, opacity 0.6 to 1
        if (hero) {
          const heroScale = 1.05 - (eased * 0.05);
          const heroY = 24 * (1 - eased);
          const heroOpacity = 0.6 + (eased * 0.4);
          hero.style.transform = `scale3d(${heroScale.toFixed(4)}, ${heroScale.toFixed(4)}, 1) translate3d(0, ${heroY.toFixed(1)}px, 0)`;
          hero.style.opacity = heroOpacity.toFixed(3);

          if (openProgress > 0.85) {
            hero.classList.add('settled');
          } else {
            hero.classList.remove('settled');
          }
        }
      }

      // Direct GPU transform on doors (zero root CSS variable recalculations)
      layerLeft.style.transform = `translate3d(${-halfGap.toFixed(1)}px, 0, 0)`;
      layerRight.style.transform = `translate3d(${halfGap.toFixed(1)}px, 0, 0)`;
      layerLeft.style.borderRightColor = `rgba(194, 87, 26, ${lineOpacity.toFixed(2)})`;
      layerRight.style.borderLeftColor = `rgba(194, 87, 26, ${lineOpacity.toFixed(2)})`;

      rafId = requestAnimationFrame(renderLoop);
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  // 4. Interactive Simulation Map (Section 4)
  function initInteractiveMap() {
    const mapSvg = document.getElementById('hero-map-svg');
    const heroMapBox = document.getElementById('hero-map-box') || document.querySelector('.hero-map-box');
    const instructionTag = document.getElementById('map-instruction');
    const routeLine = document.getElementById('map-route-line');
    const truckIcon = document.getElementById('map-truck');
    const checkIcon = document.getElementById('map-check');
    const pinGroup = document.getElementById('map-dynamic-pin');

    if (!mapSvg || !routeLine || !truckIcon || !checkIcon) return;

    // Interactive 3D Perspective Gyroscope Tilt
    const heroMapStage = heroMapBox ? heroMapBox.closest('.hero-map-stage') : null;
    if (heroMapBox && heroMapStage) {
      heroMapStage.addEventListener('mousemove', e => {
        const rect = heroMapStage.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;
        const rotX = 11 - (relY - 0.5) * 12;
        const rotY = -8 + (relX - 0.5) * 14;
        heroMapBox.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) rotateZ(1.2deg)`;
      }, { passive: true });

      heroMapStage.addEventListener('mouseleave', () => {
        heroMapBox.style.transform = 'rotateX(11deg) rotateY(-8deg) rotateZ(1.2deg)';
      });
    }

    // Fixed shelter location on map
    const shelterX = 430;
    const shelterY = 160;

    let isSimulating = false;

    mapSvg.addEventListener('click', e => {
      if (isSimulating) return;
      isSimulating = true;

      const rect = mapSvg.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 560;
      const clickY = ((e.clientY - rect.top) / rect.height) * 420;

      if (instructionTag) instructionTag.style.opacity = '0';

      // Drop elevated 3D pin at click location with ground cast shadow
      if (pinGroup) {
        pinGroup.innerHTML = `
          <g class="map-donor-pin">
            <ellipse cx="${clickX}" cy="${clickY + 4}" rx="8" ry="3.5" fill="rgba(30,27,24,0.3)"/>
            <line x1="${clickX}" y1="${clickY}" x2="${clickX}" y2="${clickY - 14}" stroke="#C2571A" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="${clickX}" cy="${clickY - 14}" r="9" fill="#C2571A" stroke="#FAF6EF" stroke-width="2.5"/>
            <circle cx="${clickX}" cy="${clickY - 14}" r="3" fill="#FAF6EF"/>
            <rect x="${clickX - 32}" y="${clickY - 34}" width="64" height="17" rx="4" fill="var(--ink)"/>
            <text x="${clickX}" y="${clickY - 22}" text-anchor="middle" font-family="var(--fb)" font-weight="700" font-size="10" fill="#FAF6EF">Donation</text>
          </g>
        `;
      }

      // Generate realistic street corner waypoint route
      const midX = clickX < shelterX ? clickX + (shelterX - clickX) * 0.5 : clickX - (clickX - shelterX) * 0.5;
      const pathD = `M ${clickX} ${clickY} L ${midX} ${clickY} L ${midX} ${shelterY} L ${shelterX} ${shelterY}`;

      routeLine.setAttribute('d', pathD);
      const totalLen = routeLine.getTotalLength();
      routeLine.style.strokeDasharray = totalLen;
      routeLine.style.strokeDashoffset = totalLen;

      // Reset markers
      checkIcon.setAttribute('opacity', '0');
      truckIcon.setAttribute('opacity', '1');

      // Animate line draw and truck along path
      const startTime = performance.now();
      const duration = 1800; // 1.8 seconds

      function animTruck(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Easing curve
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        routeLine.style.strokeDashoffset = totalLen * (1 - ease);

        const pt = routeLine.getPointAtLength(totalLen * ease);
        truckIcon.setAttribute('transform', `translate(${pt.x - 12}, ${pt.y - 12})`);

        if (progress < 1) {
          requestAnimationFrame(animTruck);
        } else {
          // Completed delivery
          truckIcon.setAttribute('opacity', '0');
          checkIcon.setAttribute('opacity', '1');
          if (instructionTag) {
            instructionTag.textContent = 'Delivery confirmed at shelter. Click anywhere to test again.';
            instructionTag.style.opacity = '1';
          }
          isSimulating = false;
        }
      }

      requestAnimationFrame(animTruck);
    });

    // Layered Parallax for Map Streets with mouse move
    const gridLayer = document.getElementById('map-grid-layer');
    if (gridLayer) {
      window.addEventListener('mousemove', e => {
        const dx = (e.clientX / window.innerWidth - 0.5) * 12;
        const dy = (e.clientY / window.innerHeight - 0.5) * 12;
        gridLayer.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      }, { passive: true });
    }
  }

  // 5. Role Switcher Tabs (Section 4)
  function initRoleTabs() {
    const tabs = document.querySelectorAll('.role-tab-btn');
    const panels = document.querySelectorAll('.role-tab-panel');

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.dataset.role;
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        panels.forEach(p => p.classList.toggle('active', p.dataset.panel === role));
      });
    });
  }

  // 6. Horizontal Scroll Workflow Panels (Section 5)
  function initHorizontalWorkflow() {
    const container = document.getElementById('how-pinned-container');
    const flexTrack = document.getElementById('how-panels-flex');
    const cards = document.querySelectorAll('.how-panel-card');

    if (!container || !flexTrack || isMobile) return;

    function onWorkScroll() {
      const rect = container.getBoundingClientRect();
      const maxScroll = rect.height - window.innerHeight;
      if (maxScroll <= 0) return;

      const progress = Math.min(1, Math.max(0, -rect.top / maxScroll));
      const totalWidth = flexTrack.scrollWidth - window.innerWidth + 160;
      const translateX = -progress * Math.max(0, totalWidth);

      flexTrack.style.transform = `translate3d(${translateX.toFixed(1)}px, 0, 0)`;

      // Trigger self-drawing SVG stroke-dashoffset when panel is in view
      cards.forEach(card => {
        const cRect = card.getBoundingClientRect();
        if (cRect.left < window.innerWidth * 0.85 && cRect.right > 0) {
          card.classList.add('in-view');
        }
      });
    }

    window.addEventListener('scroll', onWorkScroll, { passive: true });
    onWorkScroll();
  }

  // 7. 3D Tilt for Role Cards (Section 5)
  function initTiltCards() {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const cards = document.querySelectorAll('.tilt-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${(x * 12).toFixed(2)}deg) rotateX(${(-y * 12).toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)';
      });
    });
  }

  // 8. Simulation Controls Preview (Section 5)
  function initSimControls() {
    const toggles = document.querySelectorAll('.sim-toggle-item');
    const logContainer = document.getElementById('sim-interactive-log');
    const statusChip = document.getElementById('sim-status-chip');
    const riderText = document.getElementById('sim-rider-text');
    const timerText = document.getElementById('sim-timer-text');
    const demandText = document.getElementById('sim-demand-text');

    if (!toggles.length || !logContainer) return;

    let activeState = {
      riderDropped: false,
      nearExpiry: false,
      demandChanged: false
    };

    function addLog(action, desc, tone = 'ok') {
      const time = new Date().toLocaleTimeString();
      const row = document.createElement('div');
      row.className = 'sim-log-row';
      row.innerHTML = `<span class="chip ${tone}">${action}</span><span>${desc}</span><span class="mut" style="margin-left:auto;font-size:0.8rem">${time}</span>`;
      logContainer.prepend(row);
      if (logContainer.children.length > 5) {
        logContainer.lastElementChild.remove();
      }
    }

    toggles.forEach(toggle => {
      toggle.addEventListener('click', () => {
        const type = toggle.dataset.sim;
        toggle.classList.toggle('active');
        const isActive = toggle.classList.contains('active');
        activeState[type] = isActive;

        if (type === 'rider') {
          if (isActive) {
            if (riderText) riderText.textContent = 'Rider #4 (Scooter) - Unavailable (Flat tire)';
            if (statusChip) { statusChip.className = 'chip warn'; statusChip.textContent = 'Reassigned'; }
            addLog('Reallocated', 'Rider failure reported. Auto-reassigned to Rider #7 (0.9 km away).', 'warn');
          } else {
            if (riderText) riderText.textContent = 'Rider #4 (Scooter) - Active on route';
            if (statusChip) { statusChip.className = 'chip ok'; statusChip.textContent = 'In transit'; }
            addLog('Restored', 'Original rider marked ready.', 'ok');
          }
        } else if (type === 'expiry') {
          if (isActive) {
            if (timerText) { timerText.textContent = '14m 20s (Urgent)'; timerText.classList.add('low'); }
            addLog('Buffer Warning', 'Donation nearing 30m safety buffer. Route priority upgraded.', 'bad');
          } else {
            if (timerText) { timerText.textContent = '2h 45m'; timerText.classList.remove('low'); }
            addLog('Feasible', 'Donation expiryFeasibility within normal bounds.', 'ok');
          }
        } else if (type === 'demand') {
          if (isActive) {
            if (demandText) demandText.textContent = 'Demand: 65 portions (increased from 40)';
            addLog('Split Assignment', 'Shelter increased demand. Batch split between 2 available riders.', 'ok');
          } else {
            if (demandText) demandText.textContent = 'Demand: 40 portions';
            addLog('Standard Order', 'Demand reset to standard capacity.', 'ok');
          }
        }
      });
    });
  }

  // 9. Magnetic Buttons & Custom Cursor (Section 4)
  function initMagneticAndCursor() {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let cursorDot = document.getElementById('custom-cursor-dot');
    let cursorRing = document.getElementById('custom-cursor-ring');

    if (!cursorDot) {
      cursorDot = document.createElement('div');
      cursorDot.id = 'custom-cursor-dot';
      cursorDot.className = 'custom-cursor-dot';
      document.body.appendChild(cursorDot);
    }
    if (!cursorRing) {
      cursorRing = document.createElement('div');
      cursorRing.id = 'custom-cursor-ring';
      cursorRing.className = 'custom-cursor-ring';
      document.body.appendChild(cursorRing);
    }

    let ringX = 0, ringY = 0;
    let dotX = 0, dotY = 0;

    window.addEventListener('mousemove', e => {
      dotX = e.clientX;
      dotY = e.clientY;
    }, { passive: true });

    function cursorLoop() {
      ringX += (dotX - ringX) * 0.2;
      ringY += (dotY - ringY) * 0.2;
      cursorDot.style.transform = `translate3d(${(dotX - 3).toFixed(1)}px, ${(dotY - 3).toFixed(1)}px, 0)`;
      cursorRing.style.transform = `translate3d(${(ringX - 14).toFixed(1)}px, ${(ringY - 14).toFixed(1)}px, 0)`;
      requestAnimationFrame(cursorLoop);
    }
    requestAnimationFrame(cursorLoop);

    // Magnetic buttons (pull within ~40px)
    const magneticElements = document.querySelectorAll('.btn, a.logo, .role-tab-btn, .sim-toggle-item');
    magneticElements.forEach(el => {
      el.addEventListener('mousemove', e => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

        if (dist < 50) {
          const pullX = (e.clientX - centerX) * 0.22;
          const pullY = (e.clientY - centerY) * 0.22;
          el.style.transform = `translate3d(${pullX.toFixed(1)}px, ${pullY.toFixed(1)}px, 0)`;
        }
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });

      el.addEventListener('mouseenter', () => cursorRing.classList.add('hovered'));
      el.addEventListener('mouseleave', () => cursorRing.classList.remove('hovered'));
    });
  }

  // 10. Sticky Nav (Constantly visible at top, never vanishes on scroll)
  function initStickyNav() {
    const nav = document.querySelector('.top');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 15);
    }, { passive: true });
  }

  // 11. Lenis Smooth Scroll Integration
  function initLenis() {
    if (typeof window.Lenis !== 'undefined') {
      lenisInstance = new window.Lenis({
        duration: 0.82,
        easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.1
      });
      window.lenisInstance = lenisInstance;

      function lenisRaf(time) {
        if (lenisInstance) {
          lenisInstance.raf(time);
          requestAnimationFrame(lenisRaf);
        }
      }
      requestAnimationFrame(lenisRaf);

      // Handle smooth anchor & nav button clicks
      document.addEventListener('click', e => {
        const scrollBtn = e.target.closest('[data-scroll]');
        if (scrollBtn) {
          e.preventDefault();
          const targetId = scrollBtn.dataset.scroll;
          const targetEl = document.getElementById(targetId);
          if (!storyCompleted && window.completeStoryStage) {
            window.completeStoryStage();
          }
          if (targetEl && lenisInstance) {
            setTimeout(() => {
              lenisInstance.scrollTo(targetEl, { offset: -70 });
            }, 30);
          }
          return;
        }

        const anchor = e.target.closest('a[href^="#"]');
        if (anchor) {
          const href = anchor.getAttribute('href');
          if (href.startsWith('#/')) return; // Hash route like #/login
          if (href === '#' || href === '#/') return;
          const targetEl = document.querySelector(href);
          if (!storyCompleted && window.completeStoryStage) {
            window.completeStoryStage();
          }
          if (targetEl && lenisInstance) {
            e.preventDefault();
            setTimeout(() => {
              lenisInstance.scrollTo(targetEl, { offset: -70 });
            }, 30);
          }
        }
      });
    }
  }

  // 12. Scroll Reveal Animations (fade up 24px, once only)
  function initScrollReveals() {
    const elements = document.querySelectorAll('.scroll-reveal');
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    elements.forEach(el => observer.observe(el));
  }

  function setupReplayButton() {
    const replayBtn = document.getElementById('btn-replay-story');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        try {
          sessionStorage.removeItem('sr_story_done');
        } catch (e) {}
        window.location.reload();
      });
    }
  }

  // Master Landing Initializer
  window.initLandingPage = function () {
    const isStoryDone = sessionStorage.getItem('sr_story_done') === '1';

    // If story was already completed, or user prefers reduced motion, open hero permanently
    if (isStoryDone || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      storyCompleted = true;
      const stage = document.getElementById('story-stage');
      const loader = document.getElementById('story-loader');
      const scrollWrapper = document.getElementById('story-scroll-wrapper');
      const hero = document.getElementById('hero-section');
      if (loader) {
        loader.classList.add('done');
        loader.style.display = 'none';
      }
      if (scrollWrapper) {
        scrollWrapper.classList.add('completed');
        scrollWrapper.style.display = 'none';
      }
      if (stage) stage.style.display = 'none';
      if (hero) {
        hero.style.transform = 'none';
        hero.style.opacity = '1';
        hero.classList.add('settled');
      }
      initStickyNav();
      initRoleTabs();
      initInteractiveMap();
      initHorizontalWorkflow();
      initTiltCards();
      initSimControls();
      initMagneticAndCursor();
      initLenis();
      initScrollReveals();
      setupReplayButton();
      return;
    }

    preloadFrames(() => {
      initStoryStage();
      initStickyNav();
      initInteractiveMap();
      initRoleTabs();
      initHorizontalWorkflow();
      initTiltCards();
      initSimControls();
      initMagneticAndCursor();
      initLenis();
      initScrollReveals();
      setupReplayButton();
    });
  };

  // Cleanup on route departure
  window.cleanupLandingPage = function () {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (lenisInstance) {
      lenisInstance.destroy();
      lenisInstance = null;
    }
  };
})();
