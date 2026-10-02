(function () {
	const LAYERS = [
		{ canvas: 'back', share: 0.5, size: [3, 6], speed: [14, 26], alpha: [0.35, 0.65], wind: 0.5, react: 0.45, crystal: false },
		{ canvas: 'back', share: 0.38, size: [9, 17], speed: [26, 46], alpha: [0.55, 0.9], wind: 1, react: 1, crystal: true },
		{ canvas: 'front', share: 0.12, size: [18, 30], speed: [48, 80], alpha: [0.3, 0.6], wind: 1.6, react: 1.6, crystal: true },
	];

	const CRYSTAL_VARIANTS = 8;
	const SPRITE_PX = 64;

	const POINTER_RADIUS = 130;
	const POINTER_PUSH_ACCEL = 700;
	const POINTER_BASE_PUSH = 0.3;
	const POINTER_SWIRL = 0.5;
	const POINTER_DRAG = 2;
	const POINTER_MAX_SPEED = 1200;
	const POINTER_SPEED_FOR_FULL_EFFECT = 600;
	const POINTER_SPEED_SMOOTHING = 0.35;
	const POINTER_SPEED_DECAY = 6;
	const FLAKE_DAMPING = 2.2;
	const FLAKE_MAX_EXTRA_SPEED = 420;
	const TUMBLE_FROM_MOTION = 0.01;

	const ctxs = {};
	let dpr = 1;
	let crystals = [];
	let dot = null;
	let flakes = [];
	let ready = false;
	let enabled = true;
	let reducedMotion = false;
	let time = 0;
	const pointer = { x: 0, y: 0, vx: 0, vy: 0, lastMoveAt: 0, active: false };

	function randRange(a, b) {
		return a + Math.random() * (b - a);
	}

	function makeCrystalSprite() {
		const px = Math.ceil(SPRITE_PX * Math.min(dpr, 2));
		const off = document.createElement('canvas');
		off.width = px;
		off.height = px;
		const c = off.getContext('2d');
		const r = px * 0.45;
		const branchCount = 2 + ((Math.random() * 2) | 0);
		const branches = [];
		for (let i = 0; i < branchCount; i++) {
			const t = (i + 1) / (branchCount + 1) + randRange(-0.05, 0.05);
			branches.push({ t, len: r * randRange(0.2, 0.42) * (1 - t * 0.45) });
		}
		const tipFork = Math.random() < 0.5;
		const ring = Math.random() < 0.4;

		c.translate(px / 2, px / 2);
		c.strokeStyle = '#fff';
		c.lineCap = 'round';
		c.lineWidth = Math.max(1.2, px * 0.045);
		c.shadowColor = 'rgba(170, 210, 255, 0.95)';
		c.shadowBlur = px * 0.07;

		for (let a = 0; a < 6; a++) {
			c.save();
			c.rotate((a * Math.PI) / 3);
			c.beginPath();
			c.moveTo(0, 0);
			c.lineTo(0, -r);
			for (const b of branches) {
				const y = -r * b.t;
				const dx = Math.sin(Math.PI / 3) * b.len;
				const dy = Math.cos(Math.PI / 3) * b.len;
				c.moveTo(0, y);
				c.lineTo(-dx, y - dy);
				c.moveTo(0, y);
				c.lineTo(dx, y - dy);
			}
			if (tipFork) {
				const dx = Math.sin(Math.PI / 4) * r * 0.16;
				const dy = Math.cos(Math.PI / 4) * r * 0.16;
				c.moveTo(0, -r);
				c.lineTo(-dx, -r + dy);
				c.moveTo(0, -r);
				c.lineTo(dx, -r + dy);
			}
			c.stroke();
			c.restore();
		}
		if (ring) {
			c.lineWidth = Math.max(1, px * 0.03);
			c.beginPath();
			for (let i = 0; i < 6; i++) {
				const ang = (i * Math.PI) / 3;
				const rr = r * 0.3;
				c[i ? 'lineTo' : 'moveTo'](Math.sin(ang) * rr, -Math.cos(ang) * rr);
			}
			c.closePath();
			c.stroke();
		}
		return off;
	}

	function makeDotSprite() {
		const px = Math.ceil(24 * Math.min(dpr, 2));
		const off = document.createElement('canvas');
		off.width = px;
		off.height = px;
		const c = off.getContext('2d');
		const g = c.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
		g.addColorStop(0, 'rgba(255, 255, 255, 1)');
		g.addColorStop(0.45, 'rgba(255, 255, 255, 0.8)');
		g.addColorStop(1, 'rgba(255, 255, 255, 0)');
		c.fillStyle = g;
		c.fillRect(0, 0, px, px);
		return off;
	}

	function totalCount(vw, vh) {
		const cap = vw < 700 ? 90 : 190;
		let n = Math.round((vw * vh) / 8500);
		n = Math.min(cap, Math.max(45, n));
		return reducedMotion ? Math.round(n * 0.4) : n;
	}

	function layerTarget(i, vw, vh) {
		return Math.max(2, Math.round(totalCount(vw, vh) * LAYERS[i].share));
	}

	function spawn(layerIdx, vw, vh, anywhere) {
		const L = LAYERS[layerIdx];
		const size = randRange(L.size[0], L.size[1]);
		const speedMul = reducedMotion ? 0.5 : 1;
		return {
			layer: layerIdx,
			sprite: (Math.random() * CRYSTAL_VARIANTS) | 0,
			x: randRange(-size, vw + size),
			y: anywhere ? randRange(-size, vh) : -size - randRange(0, vh * 0.2),
			size,
			speed: randRange(L.speed[0], L.speed[1]) * speedMul,
			vx: 0,
			vy: 0,
			angle: randRange(0, Math.PI * 2),
			spin: reducedMotion ? 0 : randRange(8, 40) * (Math.PI / 180) * (Math.random() < 0.5 ? -1 : 1),
			driftAmp: randRange(6, 16) * L.wind,
			driftPhase: randRange(0, Math.PI * 2),
			opacity: randRange(L.alpha[0], L.alpha[1]),
		};
	}

	function fill(vw, vh, anywhere) {
		const counts = LAYERS.map((_, i) => layerTarget(i, vw, vh));
		const have = LAYERS.map(() => 0);
		flakes = flakes.filter((f) => have[f.layer]++ < counts[f.layer]);
		LAYERS.forEach((_, i) => {
			while (have[i] < counts[i]) {
				flakes.push(spawn(i, vw, vh, anywhere));
				have[i]++;
			}
		});
	}

	function clampSpeed(value) {
		return Math.max(-POINTER_MAX_SPEED, Math.min(POINTER_MAX_SPEED, value));
	}

	function onPointerMove(e) {
		if (e.pointerType === 'touch') return;
		const now = performance.now();
		if (pointer.active) {
			const elapsed = Math.max((now - pointer.lastMoveAt) / 1000, 0.008);
			const velocityX = clampSpeed((e.clientX - pointer.x) / elapsed);
			const velocityY = clampSpeed((e.clientY - pointer.y) / elapsed);
			pointer.vx += (velocityX - pointer.vx) * POINTER_SPEED_SMOOTHING;
			pointer.vy += (velocityY - pointer.vy) * POINTER_SPEED_SMOOTHING;
		}
		pointer.x = e.clientX;
		pointer.y = e.clientY;
		pointer.lastMoveAt = now;
		pointer.active = true;
	}

	function onPointerOut(e) {
		if (!e.relatedTarget) pointer.active = false;
	}

	function pushFlake(flake, reach, energy, dt) {
		const dx = flake.x - pointer.x;
		const dy = flake.y - pointer.y;
		const distance = Math.hypot(dx, dy);
		if (distance >= POINTER_RADIUS || distance < 1) return;

		const falloff = 1 - distance / POINTER_RADIUS;
		const awayX = dx / distance;
		const awayY = dy / distance;
		const side = pointer.vx * dy - pointer.vy * dx >= 0 ? 1 : -1;
		const push = falloff * falloff * POINTER_PUSH_ACCEL * energy * reach;
		const swirl = push * POINTER_SWIRL * side;
		const drag = falloff * POINTER_DRAG * reach;

		flake.vx += (awayX * push - awayY * swirl + pointer.vx * drag) * dt;
		flake.vy += (awayY * push + awayX * swirl + pointer.vy * drag) * dt;

		const extraSpeed = Math.hypot(flake.vx, flake.vy);
		if (extraSpeed > FLAKE_MAX_EXTRA_SPEED) {
			const scale = FLAKE_MAX_EXTRA_SPEED / extraSpeed;
			flake.vx *= scale;
			flake.vy *= scale;
		}
	}

	const Snow = {
		setup(backCanvas, frontCanvas, initialDpr) {
			ctxs.back = backCanvas.getContext('2d');
			ctxs.front = frontCanvas.getContext('2d');
			dpr = initialDpr || window.devicePixelRatio || 1;
			reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

			crystals = [];
			for (let i = 0; i < CRYSTAL_VARIANTS; i++) crystals.push(makeCrystalSprite());
			dot = makeDotSprite();
			window.addEventListener('pointermove', onPointerMove, { passive: true });
			document.addEventListener('pointerout', onPointerOut);
			ready = true;
			fill(window.innerWidth, window.innerHeight, true);
		},

		resize() {
			if (!ready) return;
			fill(window.innerWidth, window.innerHeight, false);
		},

		setEnabled(v) {
			enabled = v;
			if (enabled && ready && flakes.length === 0) fill(window.innerWidth, window.innerHeight, true);
			if (!enabled) {
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				ctxs.back.clearRect(0, 0, vw, vh);
				ctxs.front.clearRect(0, 0, vw, vh);
			}
		},

		tick(dt) {
			if (!ready) return;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			ctxs.back.clearRect(0, 0, vw, vh);
			ctxs.front.clearRect(0, 0, vw, vh);
			if (!enabled) return;

			time += dt;
			const gust = reducedMotion ? 0 : Math.sin(time * 0.13) * 12 + Math.sin(time * 0.37 + 1) * 6;

			const pointerSpeed = Math.hypot(pointer.vx, pointer.vy);
			const speedShare = Math.min(pointerSpeed / POINTER_SPEED_FOR_FULL_EFFECT, 1);
			const pointerEnergy = POINTER_BASE_PUSH + (1 - POINTER_BASE_PUSH) * speedShare;
			const pointerLive = pointer.active && !reducedMotion;
			const pointerDecay = Math.exp(-POINTER_SPEED_DECAY * dt);
			pointer.vx *= pointerDecay;
			pointer.vy *= pointerDecay;
			const damping = Math.exp(-FLAKE_DAMPING * dt);

			for (let i = 0; i < flakes.length; i++) {
				const f = flakes[i];
				const L = LAYERS[f.layer];
				if (pointerLive) pushFlake(f, L.react, pointerEnergy, dt);
				f.vx *= damping;
				f.vy *= damping;
				f.y += (f.speed + f.vy) * dt;
				f.angle += (f.spin + Math.sign(f.spin || 1) * Math.hypot(f.vx, f.vy) * TUMBLE_FROM_MOTION) * dt;
				f.x += (Math.sin(f.driftPhase + f.y * 0.012) * f.driftAmp + gust * L.wind + f.vx) * dt;
				if (f.y - f.size > vh) {
					flakes[i] = spawn(f.layer, vw, vh, false);
					continue;
				}
				if (f.x < -f.size * 2) f.x = vw + f.size;
				else if (f.x > vw + f.size * 2) f.x = -f.size;

				const ctx = ctxs[L.canvas];
				ctx.globalAlpha = f.opacity;
				if (L.crystal) {
					ctx.save();
					ctx.translate(f.x, f.y);
					ctx.rotate(f.angle);
					ctx.drawImage(crystals[f.sprite], -f.size / 2, -f.size / 2, f.size, f.size);
					ctx.restore();
				} else {
					ctx.drawImage(dot, f.x - f.size, f.y - f.size, f.size * 2, f.size * 2);
				}
			}
			ctxs.back.globalAlpha = 1;
			ctxs.front.globalAlpha = 1;
		},
	};

	window.Snow = Snow;
})();
