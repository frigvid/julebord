(function () {
	const FIRST_FLIGHT_DELAY_MS = [16000, 24000];
	const DELAY_BETWEEN_FLIGHTS_MS = [45000, 90000];
	const RETRY_WHEN_HIDDEN_MS = 5000;
	const FLIGHT_DURATION_MS = [15000, 19000];
	const FLIGHT_HEIGHT_RANGE = [0.07, 0.3];
	const SWOOP_COUNT_RANGE = [1, 2.5];
	const SWOOP_AMPLITUDE_RANGE = [0.02, 0.05];
	const DEPTH_SCALE_RANGE = [0.9, 1.15];
	const PATH_SAMPLES = 40;
	const LEVEL_FLIGHT_TILT_DEG = 10;

	const BELLS_SRC = 'assets/sound/sleigh-bells.mp3';
	const HO_HO_HO_SRC = 'assets/sound/ho-ho-ho.mp3';
	const BELLS_PEAK_VOLUME = 0.9;
	const HO_HO_HO_VOLUME = 0.35;
	const HO_HO_HO_AT_PROGRESS = [0.4, 0.6];
	const SOUND_TICK_MS = 100;

	let element = null;
	let bells = null;
	let hoHoHo = null;
	let canPlaySound = () => false;
	let soundTimer = 0;
	let hoHoHoTimer = 0;

	function randomBetween([min, max]) {
		return min + Math.random() * (max - min);
	}

	function flightPath(direction) {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const width = element.offsetWidth;
		const startX = direction > 0 ? -width : viewportWidth;
		const endX = direction > 0 ? viewportWidth : -width;
		const baseY = viewportHeight * randomBetween(FLIGHT_HEIGHT_RANGE);
		const swoops = randomBetween(SWOOP_COUNT_RANGE);
		const amplitude = viewportHeight * randomBetween(SWOOP_AMPLITUDE_RANGE);
		const phase = Math.random() * Math.PI * 2;
		const peakScale = randomBetween(DEPTH_SCALE_RANGE);

		return Array.from({ length: PATH_SAMPLES + 1 }, (_, i) => {
			const progress = i / PATH_SAMPLES;
			return {
				progress,
				x: startX + (endX - startX) * progress,
				y: baseY + amplitude * Math.sin(phase + progress * swoops * Math.PI * 2),
				scale: 1 + (peakScale - 1) * Math.sin(Math.PI * progress),
			};
		});
	}

	function toKeyframes(path, direction) {
		return path.map((point, i) => {
			const previous = path[Math.max(i - 1, 0)];
			const next = path[Math.min(i + 1, path.length - 1)];
			const slopeDegrees = (Math.atan2(next.y - previous.y, Math.abs(next.x - previous.x)) * 180) / Math.PI;
			const tilt = (LEVEL_FLIGHT_TILT_DEG + slopeDegrees) * direction;
			return {
				offset: point.progress,
				transform: `translate(${point.x}px, ${point.y}px) rotate(${tilt}deg) scale(${direction * point.scale}, ${point.scale})`,
			};
		});
	}

	function playFromStart(audio, volume) {
		audio.currentTime = 0;
		audio.volume = volume;
		audio.play().catch(() => {});
	}

	function followFlight(flight, duration) {
		if (!canPlaySound()) {
			stopSounds();
			return;
		}
		const progress = Math.min(flight.currentTime / duration, 1);
		bells.volume = BELLS_PEAK_VOLUME * Math.sin(Math.PI * progress);
	}

	function startSounds(flight, duration) {
		if (!canPlaySound()) return;
		playFromStart(bells, 0);
		soundTimer = setInterval(() => followFlight(flight, duration), SOUND_TICK_MS);
		hoHoHoTimer = setTimeout(() => {
			if (canPlaySound()) playFromStart(hoHoHo, HO_HO_HO_VOLUME);
		}, duration * randomBetween(HO_HO_HO_AT_PROGRESS));
	}

	function stopSounds() {
		clearInterval(soundTimer);
		clearTimeout(hoHoHoTimer);
		bells.pause();
	}

	function scheduleNextFlight(delayMs) {
		setTimeout(fly, delayMs);
	}

	function fly() {
		if (document.hidden) {
			scheduleNextFlight(RETRY_WHEN_HIDDEN_MS);
			return;
		}
		const direction = Math.random() < 0.5 ? 1 : -1;
		const duration = randomBetween(FLIGHT_DURATION_MS);
		element.hidden = false;
		const flight = element.animate(toKeyframes(flightPath(direction), direction), {
			duration,
			easing: 'linear',
			fill: 'both',
		});
		startSounds(flight, duration);
		flight.onfinish = () => {
			element.hidden = true;
			stopSounds();
			scheduleNextFlight(randomBetween(DELAY_BETWEEN_FLIGHTS_MS));
		};
	}

	const Santa = {
		setup(santaElement, options) {
			const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (reducedMotion || !santaElement.animate) return;
			element = santaElement;
			element.src = element.dataset.src;
			bells = new Audio(BELLS_SRC);
			hoHoHo = new Audio(HO_HO_HO_SRC);
			bells.preload = 'auto';
			hoHoHo.preload = 'auto';
			if (options && options.canPlaySound) canPlaySound = options.canPlaySound;
			scheduleNextFlight(randomBetween(FIRST_FLIGHT_DELAY_MS));
		},
	};

	window.Santa = Santa;
})();
