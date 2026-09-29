(function () {
	const LAYERS = [
		{ canvas: 'back', share: 0.5, size: [3, 6], speed: [14, 26], alpha: [0.35, 0.65], wind: 0.5, crystal: false },
		{ canvas: 'back', share: 0.38, size: [9, 17], speed: [26, 46], alpha: [0.55, 0.9], wind: 1, crystal: true },
		{ canvas: 'front', share: 0.12, size: [18, 30], speed: [48, 80], alpha: [0.3, 0.6], wind: 1.6, crystal: true },
	];

	const CRYSTAL_VARIANTS = 8;
	const SPRITE_PX = 64;

	const ctxs = {};
	let dpr = 1;
	let crystals = [];
	let dot = null;
	let flakes = [];
	let ready = false;
	let enabled = true;
	let reducedMotion = false;
	let time = 0;
	let pointerWind = 0;
	let lastPointerX = null;

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

	function onPointerMove(e) {
		if (e.pointerType !== 'mouse') return;
		if (lastPointerX !== null) {
			pointerWind = Math.max(-90, Math.min(90, pointerWind + (e.clientX - lastPointerX) * 0.5));
		}
		lastPointerX = e.clientX;
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
			pointerWind *= Math.exp(-dt * 1.5);
			const gust = reducedMotion ? 0 : Math.sin(time * 0.13) * 12 + Math.sin(time * 0.37 + 1) * 6;
			const wind = gust + pointerWind;

			for (let i = 0; i < flakes.length; i++) {
				const f = flakes[i];
				const L = LAYERS[f.layer];
				f.y += f.speed * dt;
				f.angle += f.spin * dt;
				f.x += (Math.sin(f.driftPhase + f.y * 0.012) * f.driftAmp + wind * L.wind) * dt;
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
