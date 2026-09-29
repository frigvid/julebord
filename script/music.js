(function () {
	const PLAYLIST = [
		{ title: 'The First Noel', artist: 'U.S. Air Force Band', src: 'assets/music/the-first-noel.mp3' },
	];

	const TARGET_VOLUME = 0.5;
	const FADE_MS = 2500;
	const PREF_KEY = 'xmas-music';
	const MUSIC_CONTROLS_SELECTOR = '#music-toggle, #toggle-music';

	let audio = null;
	let opts = {};
	let idx = 0;
	let wanted = true;
	let playing = false;
	let resumeOnVisible = false;
	let gestureBound = false;
	let fadeRaf = 0;

	function readPref() {
		try {
			return localStorage.getItem(PREF_KEY) !== 'off';
		} catch (e) {
			return true;
		}
	}

	function writePref(v) {
		try {
			localStorage.setItem(PREF_KEY, v ? 'on' : 'off');
		} catch (e) {}
	}

	function emit() {
		if (opts.onChange) opts.onChange({ playing, wanted });
	}

	function showHint(v) {
		if (opts.hintEl) opts.hintEl.hidden = !v;
	}

	function load(i) {
		idx = i % PLAYLIST.length;
		audio.src = PLAYLIST[idx].src;
		audio.loop = PLAYLIST.length === 1;
		if (opts.nowPlayingEl) opts.nowPlayingEl.textContent = PLAYLIST[idx].title;
		if (opts.artistEl) opts.artistEl.textContent = PLAYLIST[idx].artist;
	}

	function fadeIn() {
		cancelAnimationFrame(fadeRaf);
		const t0 = performance.now();
		audio.volume = 0;
		function step(now) {
			const k = Math.min(1, (now - t0) / FADE_MS);
			audio.volume = TARGET_VOLUME * k;
			if (k < 1) fadeRaf = requestAnimationFrame(step);
		}
		step(t0);
	}

	function isMusicControl(target) {
		return Boolean(target.closest && target.closest(MUSIC_CONTROLS_SELECTOR));
	}

	function onGesture(e) {
		if (isMusicControl(e.target)) return;
		attemptPlay();
	}

	function bindGesture() {
		if (gestureBound) return;
		gestureBound = true;
		['click', 'keydown', 'touchend'].forEach((t) => document.addEventListener(t, onGesture, true));
	}

	function unbindGesture() {
		if (!gestureBound) return;
		gestureBound = false;
		['click', 'keydown', 'touchend'].forEach((t) => document.removeEventListener(t, onGesture, true));
	}

	function attemptPlay() {
		const p = audio.play();
		if (!p) return;
		p.then(() => {
			unbindGesture();
			showHint(false);
			fadeIn();
		}).catch((err) => {
			const blockedByBrowser = err && err.name === 'NotAllowedError';
			if (blockedByBrowser && wanted) {
				showHint(true);
				bindGesture();
			}
		});
	}

	const Music = {
		init(options) {
			opts = options || {};
			wanted = readPref();
			audio = new Audio();
			audio.preload = 'none';
			audio.volume = TARGET_VOLUME;
			load(0);

			audio.addEventListener('play', () => {
				playing = true;
				emit();
			});
			audio.addEventListener('pause', () => {
				playing = false;
				emit();
			});
			audio.addEventListener('ended', () => {
				if (PLAYLIST.length > 1) {
					load(idx + 1);
					audio.play().catch(() => {});
				}
			});
			document.addEventListener('visibilitychange', () => {
				if (document.hidden) {
					if (playing) {
						resumeOnVisible = true;
						audio.pause();
					}
				} else if (resumeOnVisible) {
					resumeOnVisible = false;
					if (wanted) audio.play().catch(() => {});
				}
			});

			emit();
			if (wanted) attemptPlay();
		},

		setEnabled(v) {
			wanted = v;
			writePref(v);
			if (v) {
				showHint(false);
				attemptPlay();
			} else {
				showHint(false);
				unbindGesture();
				resumeOnVisible = false;
				audio.pause();
			}
			emit();
		},

		toggle() {
			const shouldPlay = !playing;
			Music.setEnabled(shouldPlay);
		},
	};

	window.Music = Music;
})();
