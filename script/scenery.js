(function () {
	function makeSeededRng(seed) {
		return function () {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	const HILLS = [
		{ base: 0.7, amp: 0.035, phase: 0.6, top: '#8093c9', bottom: '#4d629f', tree: '#26396d', trees: 16, scale: 0.6 },
		{ base: 0.8, amp: 0.04, phase: 2.4, top: '#c8d5f1', bottom: '#8fa3d3', tree: '#143a44', trees: 11, scale: 0.9 },
		{ base: 0.9, amp: 0.03, phase: 4.1, top: '#f6f9ff', bottom: '#cfdcf3', tree: '#0c352f', trees: 6, scale: 1.3 },
	];

	let canvas, ctx;

	function hillY(x, vw, vh, h) {
		const u = (x / vw) * Math.PI * 2;
		return vh * (h.base + Math.sin(u + h.phase) * h.amp + Math.sin(u * 2.3 + h.phase * 2.1) * h.amp * 0.45);
	}

	function drawMoon(vw, vh) {
		const r = Math.max(26, Math.min(52, Math.min(vw, vh) * 0.06));
		const x = vw * 0.82;
		const y = vh * 0.15;
		const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 4);
		glow.addColorStop(0, 'rgba(255, 246, 214, 0.35)');
		glow.addColorStop(1, 'rgba(255, 246, 214, 0)');
		ctx.fillStyle = glow;
		ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
		ctx.fillStyle = '#fff6d6';
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = 'rgba(200, 185, 140, 0.35)';
		[[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.1, 0.4, 0.12]].forEach(([dx, dy, k]) => {
			ctx.beginPath();
			ctx.arc(x + dx * r, y + dy * r, k * r, 0, Math.PI * 2);
			ctx.fill();
		});
	}

	function drawTree(x, y, h, color) {
		ctx.fillStyle = '#2b1d16';
		ctx.fillRect(x - h * 0.03, y - h * 0.12, h * 0.06, h * 0.14);
		for (let i = 0; i < 3; i++) {
			const baseY = y - h * 0.1 - i * h * 0.27;
			const th = h * 0.42;
			const hw = h * (0.3 - i * 0.07);
			const apexY = baseY - th;
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(x, apexY);
			ctx.lineTo(x + hw, baseY);
			ctx.lineTo(x - hw, baseY);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
			ctx.beginPath();
			ctx.moveTo(x, apexY);
			ctx.lineTo(x - hw * 0.6, apexY + th * 0.58);
			ctx.lineTo(x - hw * 0.25, apexY + th * 0.47);
			ctx.lineTo(x, apexY + th * 0.6);
			ctx.lineTo(x + hw * 0.25, apexY + th * 0.47);
			ctx.lineTo(x + hw * 0.6, apexY + th * 0.58);
			ctx.closePath();
			ctx.fill();
		}
	}

	const Scenery = {
		setup(canvasEl) {
			canvas = canvasEl;
			ctx = canvas.getContext('2d');
		},

		draw() {
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const vmin = Math.min(vw, vh);
			const rng = makeSeededRng(1225);
			ctx.clearRect(0, 0, vw, vh);
			drawMoon(vw, vh);

			HILLS.forEach((h) => {
				const top = vh * (h.base - h.amp * 1.5);
				const grad = ctx.createLinearGradient(0, top, 0, vh);
				grad.addColorStop(0, h.top);
				grad.addColorStop(1, h.bottom);
				ctx.fillStyle = grad;
				ctx.beginPath();
				ctx.moveTo(0, vh);
				for (let x = 0; x <= vw + 8; x += 8) ctx.lineTo(x, hillY(x, vw, vh, h));
				ctx.lineTo(vw, vh);
				ctx.closePath();
				ctx.fill();

				const narrowScreenFactor = Math.min(1, vw / 1200);
				const treeCount = Math.max(3, Math.round(h.trees * narrowScreenFactor));
				for (let i = 0; i < treeCount; i++) {
					const x = rng() * vw;
					const th = vmin * (0.07 + rng() * 0.07) * h.scale;
					drawTree(x, hillY(x, vw, vh, h) + 4, th, h.tree);
				}
			});
		},

		buildStars(container) {
			const n = Math.max(30, Math.min(120, Math.round((window.innerWidth * window.innerHeight) / 9000)));
			const rng = makeSeededRng(24);
			const frag = document.createDocumentFragment();
			for (let i = 0; i < n; i++) {
				const s = document.createElement('span');
				const size = 1 + rng() * 2;
				s.className = 'star';
				s.style.cssText =
					'left:' + (rng() * 100).toFixed(2) + '%;top:' + (rng() * 60).toFixed(2) + '%;' +
					'width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;' +
					'animation-duration:' + (2 + rng() * 3).toFixed(2) + 's;animation-delay:-' + (rng() * 5).toFixed(2) + 's';
				frag.appendChild(s);
			}
			container.appendChild(frag);
		},

		buildLights(container) {
			const COLORS = ['#ff3b4a', '#ffd35c', '#3ddc84', '#4aa8ff'];
			const U = [0.17, 0.5, 0.83];
			const segs = Math.ceil(window.innerWidth / 120) + 1;
			container.textContent = '';
			for (let s = 0; s < segs; s++) {
				const seg = document.createElement('div');
				seg.className = 'light-seg';
				U.forEach((u, i) => {
					const k = s * 3 + i;
					const b = document.createElement('span');
					b.className = 'bulb';
					b.style.cssText =
						'left:' + u * 100 + '%;top:' + (22 * Math.sqrt(1 - Math.pow(2 * u - 1, 2)) - 2).toFixed(1) + 'px;' +
						'--c:' + COLORS[k % COLORS.length] + ';animation-delay:-' + ((k * 0.47) % 1.8).toFixed(2) + 's';
					seg.appendChild(b);
				});
				container.appendChild(seg);
			}
		},
	};

	window.Scenery = Scenery;
})();
