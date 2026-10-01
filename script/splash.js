(function () {
	const FADE_STARTS_AFTER_PLAY_MS = 5700;
	const LOAD_TIMEOUT_MS = 6000;
	const PREF_KEY = 'xmas-splash';

	const splash = document.getElementById('splash');
	const canvas = document.getElementById('splash-canvas');
	const skipButton = document.getElementById('splash-skip');
	const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let animation = null;
	let loaded = false;
	let finished = false;

	function isEnabled() {
		try {
			return localStorage.getItem(PREF_KEY) !== 'off';
		} catch (e) {
			return true;
		}
	}

	function setEnabled(enabled) {
		try {
			localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off');
		} catch (e) {}
	}

	window.Splash = { isEnabled, setEnabled };

	function announceFinished() {
		if (finished) return;
		finished = true;
		document.dispatchEvent(new Event('splash-finished'));
	}

	function removeSplash() {
		if (animation) animation.cleanup();
		splash.remove();
	}

	function dismissSplash() {
		announceFinished();
		removeSplash();
	}

	function fadeIntoApp() {
		if (finished) return;
		announceFinished();
		splash.classList.add('is-fading');
		splash.addEventListener('transitionend', removeSplash, { once: true });
	}

	skipButton.addEventListener('click', () => {
		splash.classList.add('is-skipped');
		fadeIntoApp();
	});

	if (reducedMotion || !window.rive || !isEnabled()) {
		dismissSplash();
		return;
	}

	rive.RuntimeLoader.setWasmUrl('script/lib/rive.wasm');

	animation = new rive.Rive({
		src: 'assets/animation/christmas_tree.riv',
		canvas,
		autoplay: true,
		autoBind: true,
		stateMachine: 'State Machine 1',
		layout: new rive.Layout({ fit: rive.Fit.Cover, alignment: rive.Alignment.Center }),
		onLoad: () => {
			loaded = true;
			animation.resizeDrawingSurfaceToCanvas();
		},
		onLoadError: dismissSplash,
		onPlay: () => setTimeout(fadeIntoApp, FADE_STARTS_AFTER_PLAY_MS),
		onStop: fadeIntoApp,
	});

	window.addEventListener('resize', () => animation.resizeDrawingSurfaceToCanvas());
	setTimeout(() => loaded || dismissSplash(), LOAD_TIMEOUT_MS);
})();
