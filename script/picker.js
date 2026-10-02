(function () {
	if (!window.Snow || !window.Scenery) return;

	const sceneryCanvas = document.getElementById('scenery-canvas');
	const backCanvas = document.getElementById('snow-back-canvas');
	const frontCanvas = document.getElementById('snow-front-canvas');
	const lights = document.getElementById('lights');
	const stars = document.getElementById('stars');
	const canvases = [sceneryCanvas, backCanvas, frontCanvas];

	const MAX_DPR = 2;
	const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

	function sizeCanvases() {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		canvases.forEach((c) => {
			c.width = Math.round(vw * dpr);
			c.height = Math.round(vh * dpr);
			c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
		});
	}

	let lastWidth = window.innerWidth;
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

	let last = performance.now();
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

	sizeCanvases();
	Scenery.setup(sceneryCanvas);
	Scenery.draw();
	Scenery.buildStars(stars);
	Scenery.buildLights(lights);
	Snow.setup(backCanvas, frontCanvas, dpr);
	Snow.setEnabled(true);

	window.addEventListener('resize', onWindowResize);
	window.addEventListener('orientationchange', onWindowResize);

	canvases.forEach((c) => c.classList.add('visible'));
	requestAnimationFrame(frame);
})();
