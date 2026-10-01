(function () {
	function stubOf(methodNames) {
		return Object.fromEntries(methodNames.map((name) => [name, () => {}]));
	}

	const Snow = window.Snow || stubOf(['setup', 'resize', 'setEnabled', 'tick']);
	const Scenery = window.Scenery || stubOf(['setup', 'draw', 'buildStars', 'buildLights']);
	const Music = window.Music || stubOf(['init', 'setEnabled', 'toggle', 'isPlaying']);
	const Santa = window.Santa || stubOf(['setup']);
	const Attributions = window.Attributions || stubOf(['init', 'open']);
	const Splash = window.Splash || { isEnabled: () => true, setEnabled: () => {} };
	const effectsBlocked = [window.Snow, window.Scenery, window.Music].some((piece) => !piece);

	const sceneryCanvas = document.getElementById('scenery-canvas');
	const backCanvas = document.getElementById('snow-back-canvas');
	const frontCanvas = document.getElementById('snow-front-canvas');
	const lights = document.getElementById('lights');
	const stars = document.getElementById('stars');
	const canvases = [sceneryCanvas, backCanvas, frontCanvas];

	const menuToggle = document.getElementById('menu-toggle');
	const menuPanel = document.getElementById('menu-panel');
	const musicToggle = document.getElementById('music-toggle');
	const toggleMusic = document.getElementById('toggle-music');
	const toggleSnow = document.getElementById('toggle-snow');
	const toggleLights = document.getElementById('toggle-lights');
	const toggleSplash = document.getElementById('toggle-splash');
	const openAttributions = document.getElementById('open-attributions');

	const blockedToast = document.getElementById('blocked-toast');
	const blockedToastClose = document.getElementById('blocked-toast-close');

	const MAX_DPR = 2;
	const TOAST_DURATION_MS = 15000;
	const SPLASH_WAIT_LIMIT_MS = 12000;
	const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

	function hideBlockedToast() {
		blockedToast.hidden = true;
	}

	function showBlockedToast() {
		blockedToast.hidden = false;
		setTimeout(hideBlockedToast, TOAST_DURATION_MS);
	}

	function sizeCanvases() {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		canvases.forEach((c) => {
			c.width = Math.round(vw * dpr);
			c.height = Math.round(vh * dpr);
			c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
		});
	}

	let lastWidth = 0;
	function handleResize() {
		sizeCanvases();
		Scenery.draw();
		Snow.resize();
		const widthChanged = window.innerWidth !== lastWidth;
		if (widthChanged) {
			lastWidth = window.innerWidth;
			Scenery.buildLights(lights);
		}
	}

	let resizeTimer = null;
	function onWindowResize() {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(handleResize, 120);
	}

	function closeMenu() {
		menuPanel.hidden = true;
		menuToggle.setAttribute('aria-expanded', 'false');
	}
	function openMenu() {
		menuPanel.hidden = false;
		menuToggle.setAttribute('aria-expanded', 'true');
	}
	menuToggle.addEventListener('click', (e) => {
		e.stopPropagation();
		if (menuPanel.hidden) openMenu();
		else closeMenu();
	});
	document.addEventListener('click', (e) => {
		if (!menuPanel.hidden && !e.target.closest('.menu')) closeMenu();
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !menuPanel.hidden) closeMenu();
	});

	toggleSnow.addEventListener('change', () => Snow.setEnabled(toggleSnow.checked));
	toggleLights.addEventListener('change', () => lights.classList.toggle('off', !toggleLights.checked));
	toggleMusic.addEventListener('change', () => Music.setEnabled(toggleMusic.checked));
	musicToggle.addEventListener('click', () => Music.toggle());

	toggleSplash.checked = Splash.isEnabled();
	toggleSplash.addEventListener('change', () => Splash.setEnabled(toggleSplash.checked));

	Attributions.init();
	openAttributions.addEventListener('click', () => {
		closeMenu();
		Attributions.open();
	});

	let last = 0;
	function frame(now) {
		if (document.hidden) {
			last = now;
			requestAnimationFrame(frame);
			return;
		}
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		Snow.tick(dt);
		requestAnimationFrame(frame);
	}

	let started = false;
	function start() {
		if (started) return;
		started = true;

		sizeCanvases();
		Scenery.setup(sceneryCanvas);
		Scenery.draw();
		Scenery.buildStars(stars);
		lastWidth = window.innerWidth;
		Scenery.buildLights(lights);
		Snow.setup(backCanvas, frontCanvas, dpr);
		Snow.setEnabled(toggleSnow.checked);

		window.addEventListener('resize', onWindowResize);
		window.addEventListener('orientationchange', onWindowResize);

		Music.init({
			hintEl: document.getElementById('music-hint'),
			nowPlayingEl: document.getElementById('now-playing'),
			artistEl: document.getElementById('now-playing-artist'),
			onChange({ playing, wanted }) {
				musicToggle.setAttribute('aria-pressed', String(playing));
				toggleMusic.checked = wanted;
			},
		});

		Santa.setup(document.getElementById('santa'), { canPlaySound: () => Music.isPlaying() });

		blockedToastClose.addEventListener('click', hideBlockedToast);
		if (effectsBlocked) showBlockedToast();

		canvases.forEach((c) => c.classList.add('visible'));
		last = performance.now();
		requestAnimationFrame(frame);
	}

	document.addEventListener('splash-finished', start, { once: true });
	setTimeout(start, SPLASH_WAIT_LIMIT_MS);
	if (!document.getElementById('splash')) start();
})();
