(function () {
	const INTRO = 'Takk til alle som har laget og delt animasjonene, musikken og lydene som brukes på denne nettsiden.';
	const SOURCE_LINK_LABEL = 'Kilde';

	let backdrop = null;
	let closeButton = null;
	let previouslyFocused = null;

	function element(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text) node.textContent = text;
		return node;
	}

	function isImagePath(icon) {
		return /\.(png|jpe?g|webp|gif|svg)$/i.test(icon);
	}

	function renderImageIcon(path) {
		const image = element('img', 'attribution-icon');
		image.src = path;
		image.alt = '';
		image.loading = 'lazy';
		return image;
	}

	function renderEmojiIcon(emoji) {
		const badge = element('span', 'attribution-icon attribution-emoji', emoji);
		badge.setAttribute('aria-hidden', 'true');
		return badge;
	}

	function renderIcon(icon) {
		return isImagePath(icon) ? renderImageIcon(icon) : renderEmojiIcon(icon);
	}

	function renderEntry(entry) {
		const link = element('a', 'attribution-link', SOURCE_LINK_LABEL);
		link.href = entry.url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';

		const text = element('div', 'attribution-text');
		text.append(
			element('div', 'attribution-title', entry.title),
			element('div', 'attribution-creator', entry.creator),
			element('div', 'attribution-detail', entry.detail),
			link
		);

		const item = element('li', 'attribution-entry');
		if (entry.icon) item.append(renderIcon(entry.icon));
		item.append(text);
		return item;
	}

	function renderGroup(group) {
		const list = element('ul', 'attribution-list');
		list.append(...group.entries.map(renderEntry));

		const section = element('section', 'attribution-group');
		section.append(element('h3', 'attribution-group-title', group.group), list);
		return section;
	}

	function render(container) {
		container.append(element('p', 'attributions-intro', INTRO));
		container.append(...(window.ATTRIBUTIONS || []).map(renderGroup));
	}

	function open() {
		previouslyFocused = document.activeElement;
		backdrop.hidden = false;
		closeButton.focus();
	}

	function close() {
		backdrop.hidden = true;
		if (previouslyFocused) previouslyFocused.focus();
	}

	const Attributions = {
		init() {
			backdrop = document.getElementById('attributions-dialog');
			closeButton = document.getElementById('attributions-close');
			render(document.getElementById('attributions-body'));

			closeButton.addEventListener('click', close);
			backdrop.addEventListener('click', (event) => {
				if (event.target === backdrop) close();
			});
			document.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' && !backdrop.hidden) close();
			});
		},
		open,
	};

	window.Attributions = Attributions;
})();
