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

	const CHRISTMAS_CONFETTI = ['#d3132f', '#1f8a43', '#ffd35c', '#ffffff'];
	const CRUMB_CONFETTI = ['#c68b4e', '#a86a32', '#7a4a22', '#e2b07a'];
	const DROP_KINDS = [
		{
			weight: 3,
			round: false,
			sizeRange: [30, 44],
			confetti: CHRISTMAS_CONFETTI,
			srcs: [
				'assets/images/gift-yellow.svg',
				'assets/images/gift-red.svg',
				'assets/images/gift-green.svg',
				'assets/images/gift-white.svg',
				'assets/images/gift-blue.svg',
			],
		},
		{ weight: 2, round: true, sizeRange: [26, 36], confetti: CRUMB_CONFETTI, srcs: ['assets/images/cookie.svg'] },
	];
	const GIFT_COUNT_RANGE = [1, 3];
	const ROLL_BOOST = 2;
	const ROLL_FRICTION = 2;
	const ROLL_MIN_SPEED = 6;
	const GIFT_GROUND_RANGE = [0.86, 0.95];
	const GIFT_START_SPEED_X_RANGE = [30, 90];
	const GIFT_START_SPEED_Y_RANGE = [-80, -10];
	const GIFT_SPIN_RANGE_DEG = [-90, 90];
	const GIFT_GRAVITY = 900;
	const GIFT_BOUNCE_KEEP = 0.35;
	const GIFT_MIN_BOUNCE_SPEED = 140;
	const GIFT_SWAY_DEG = 14;
	const GIFT_SWAY_HZ = 1.6;
	const GIFT_SETTLE_RATE = 6;
	const GIFT_REST_MS = 12000;
	const GIFT_FADE_MS = 800;
	const GIFT_OPEN_MS = 260;
	const GIFT_OPEN_GROWTH = 0.45;
	const GIFT_LIMIT = 15;
	const SLEIGH_ALONG_IMAGE = 0.18;
	const SLEIGH_DOWN_IMAGE = 0.62;

	const CONFETTI_COUNT_RANGE = [16, 26];
	const CONFETTI_SIZE_RANGE_PX = [5, 9];
	const CONFETTI_SPEED_RANGE = [120, 380];
	const CONFETTI_LIFE_MS_RANGE = [900, 1500];
	const CONFETTI_SPIN_RANGE_DEG = [-540, 540];
	const CONFETTI_GRAVITY = 700;
	const CONFETTI_DRAG = 1.6;
	const CONFETTI_LIFT = 120;

	let element = null;
	let bells = null;
	let hoHoHo = null;
	let canPlaySound = () => false;
	let soundTimer = 0;
	let hoHoHoTimer = 0;
	let flightDirection = 1;
	let gifts = [];
	let confetti = [];
	let giftFrame = 0;
	let lastGiftFrame = 0;

	function randomBetween([min, max]) {
		return min + Math.random() * (max - min);
	}

	function randomIntBetween([min, max]) {
		return min + Math.floor(Math.random() * (max - min + 1));
	}

	function pickDropKind() {
		let roll = Math.random() * DROP_KINDS.reduce((sum, kind) => sum + kind.weight, 0);
		return DROP_KINDS.find((kind) => (roll -= kind.weight) < 0);
	}

	function createGift(x, y) {
		const kind = pickDropKind();
		const size = randomBetween(kind.sizeRange);
		const node = new Image();
		node.src = kind.srcs[randomIntBetween([0, kind.srcs.length - 1])];
		node.alt = '';
		node.className = 'gift';
		node.style.width = `${size}px`;
		document.body.append(node);

		const gift = {
			node,
			kind,
			size,
			x: x - size / 2 + randomBetween([-12, 12]),
			y: y - size / 2,
			vx: flightDirection * randomBetween(GIFT_START_SPEED_X_RANGE),
			vy: randomBetween(GIFT_START_SPEED_Y_RANGE),
			angle: randomBetween([-20, 20]),
			spin: randomBetween(GIFT_SPIN_RANGE_DEG),
			swayPhase: Math.random() * Math.PI * 2,
			groundY: window.innerHeight * randomBetween(GIFT_GROUND_RANGE) - size,
			bounced: false,
			rolling: false,
			opened: false,
			impactAt: 0,
			landedAt: 0,
			removeAt: 0,
			fadeMs: GIFT_FADE_MS,
		};
		node.addEventListener('click', () => openGift(gift));
		renderGift(gift, performance.now());
		return gift;
	}

	function landGift(gift, now) {
		gift.y = gift.groundY;
		gift.impactAt = now;
		if (!gift.bounced && gift.vy > GIFT_MIN_BOUNCE_SPEED) {
			gift.vy = -gift.vy * GIFT_BOUNCE_KEEP;
			gift.vx *= 0.5;
			gift.spin *= 0.4;
			gift.bounced = true;
			return;
		}
		gift.vy = 0;
		gift.spin = 0;
		gift.landedAt = now;
		if (gift.kind.round) {
			gift.vx *= ROLL_BOOST;
			gift.rolling = Math.abs(gift.vx) > ROLL_MIN_SPEED;
		} else {
			gift.vx = 0;
			gift.angle = ((((gift.angle + 180) % 360) + 360) % 360) - 180;
		}
		gift.node.classList.add('gift-landed');
	}

	function rollGift(gift, dt) {
		const maxX = window.innerWidth - gift.size;
		gift.x = Math.max(0, Math.min(maxX, gift.x + gift.vx * dt));
		gift.angle += ((gift.vx / (gift.size / 2)) * 180) / Math.PI * dt;
		gift.vx *= Math.exp(-dt * ROLL_FRICTION);
		if (Math.abs(gift.vx) < ROLL_MIN_SPEED || gift.x === 0 || gift.x === maxX) {
			gift.vx = 0;
			gift.rolling = false;
		}
	}

	function createConfetti(x, y, colors) {
		const size = randomBetween(CONFETTI_SIZE_RANGE_PX);
		const node = document.createElement('span');
		node.className = 'confetti';
		node.style.width = `${size}px`;
		node.style.height = `${size * randomBetween([0.5, 1])}px`;
		node.style.background = colors[randomIntBetween([0, colors.length - 1])];
		node.style.borderRadius = Math.random() < 0.4 ? '50%' : '1px';
		document.body.append(node);

		const heading = Math.random() * Math.PI * 2;
		const speed = randomBetween(CONFETTI_SPEED_RANGE);
		return {
			node,
			x,
			y,
			vx: Math.cos(heading) * speed,
			vy: Math.sin(heading) * speed - CONFETTI_LIFT,
			angle: randomBetween([0, 360]),
			spin: randomBetween(CONFETTI_SPIN_RANGE_DEG),
			lifeMs: randomBetween(CONFETTI_LIFE_MS_RANGE),
			ageMs: 0,
		};
	}

	function updateConfetti(piece, dt) {
		piece.ageMs += dt * 1000;
		piece.vy += CONFETTI_GRAVITY * dt;
		piece.vx *= Math.exp(-CONFETTI_DRAG * dt);
		piece.x += piece.vx * dt;
		piece.y += piece.vy * dt;
		piece.angle += piece.spin * dt;
		piece.node.style.transform = `translate(${piece.x}px, ${piece.y}px) rotate(${piece.angle}deg)`;
		piece.node.style.opacity = Math.max(0, 1 - piece.ageMs / piece.lifeMs);
	}

	function renderGift(gift, now) {
		const sway = gift.landedAt
			? 0
			: Math.sin((now / 1000) * GIFT_SWAY_HZ * Math.PI * 2 + gift.swayPhase) * GIFT_SWAY_DEG;
		const sinceImpact = (now - gift.impactAt) / 1000;
		const squash = gift.impactAt ? Math.exp(-sinceImpact * 12) * Math.cos(sinceImpact * 28) * 0.2 : 0;
		const remaining = gift.removeAt ? Math.max(0, (gift.removeAt - now) / gift.fadeMs) : 1;
		const growth = gift.opened ? 1 + GIFT_OPEN_GROWTH * (1 - remaining) : 1;
		gift.node.style.transform =
			`translate(${gift.x}px, ${gift.y}px) rotate(${gift.angle + sway}deg) scale(${(1 + squash * 0.7) * growth}, ${(1 - squash) * growth})`;
		gift.node.style.opacity = remaining;
	}

	function updateGift(gift, now, dt) {
		if (!gift.landedAt) {
			gift.vy += GIFT_GRAVITY * dt;
			gift.x += gift.vx * dt;
			gift.y += gift.vy * dt;
			gift.angle += gift.spin * dt;
			gift.spin *= Math.exp(-dt * 0.8);
			if (gift.y >= gift.groundY) landGift(gift, now);
		} else {
			if (gift.rolling) rollGift(gift, dt);
			else if (!gift.kind.round) gift.angle *= Math.exp(-dt * GIFT_SETTLE_RATE);
			if (!gift.removeAt && now - gift.landedAt > GIFT_REST_MS) {
				gift.node.classList.remove('gift-landed');
				gift.removeAt = now + GIFT_FADE_MS;
			}
		}
		renderGift(gift, now);
	}

	function step(now) {
		const dt = Math.min((now - lastGiftFrame) / 1000, 0.05);
		lastGiftFrame = now;
		gifts.forEach((gift) => updateGift(gift, now, dt));
		confetti.forEach((piece) => updateConfetti(piece, dt));
		gifts = gifts.filter((gift) => {
			const done = gift.removeAt && now >= gift.removeAt;
			if (done) gift.node.remove();
			return !done;
		});
		confetti = confetti.filter((piece) => {
			const done = piece.ageMs >= piece.lifeMs;
			if (done) piece.node.remove();
			return !done;
		});
		giftFrame = gifts.length || confetti.length ? requestAnimationFrame(step) : 0;
	}

	function startAnimating() {
		if (giftFrame) return;
		lastGiftFrame = performance.now();
		giftFrame = requestAnimationFrame(step);
	}

	function openGift(gift) {
		if (gift.opened) return;
		gift.opened = true;
		gift.node.classList.remove('gift-landed');
		gift.removeAt = performance.now() + GIFT_OPEN_MS;
		gift.fadeMs = GIFT_OPEN_MS;
		const count = randomIntBetween(CONFETTI_COUNT_RANGE);
		for (let i = 0; i < count; i++) {
			confetti.push(createConfetti(gift.x + gift.size / 2, gift.y + gift.size / 2, gift.kind.confetti));
		}
		startAnimating();
	}

	function dropGifts() {
		const rect = element.getBoundingClientRect();
		const sleighX = rect.left + rect.width * (flightDirection > 0 ? SLEIGH_ALONG_IMAGE : 1 - SLEIGH_ALONG_IMAGE);
		const sleighY = rect.top + rect.height * SLEIGH_DOWN_IMAGE;
		const count = Math.min(randomIntBetween(GIFT_COUNT_RANGE), GIFT_LIMIT - gifts.length);
		for (let i = 0; i < count; i++) gifts.push(createGift(sleighX, sleighY));
		startAnimating();
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
		flightDirection = direction;
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
			element.addEventListener('click', dropGifts);
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
