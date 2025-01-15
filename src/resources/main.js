const isSafari =
	/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
	typeof window.webkitIndexedDB === "object";

function updateText(t) {
	const { text } = t.dataset;
	document.querySelector(`#${text}-text`).textContent = t.value;

	if (text === "tertiary") {
		const quaternaryInput = document.querySelector(
			"input[data-text='quaternary']",
		);
		if (!quaternaryInput.disabled) {
			return;
		}
		quaternaryInput.value = t.value;
		updateText(quaternaryInput);
	}
}

function fileToDataURL(file) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result);
		reader.readAsDataURL(file);
	});
}

async function updateImage(data, i) {
	try {
		if (!data.files[0].type.startsWith("image/")) {
			return;
		}
	} catch (e) {
		if (e) {
			return;
		}
	}

	const e = document.querySelector(`image[data-image="${i}"`);
	const label = document.querySelector(`label[data-image="${i}"`);

	const file = data.files[0];

	label.textContent = file.name || label.dataset.text;

	const image = new Image();
	image.onload = () => {
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		const boxHeight = Number(e.getAttribute("height"));
		const imgAspect = image.naturalWidth / image.naturalHeight;
		const width = boxHeight * imgAspect;
		const height = boxHeight;
		canvas.width = width;
		canvas.height = height;
		ctx.drawImage(image, 0, 0, width, height);
		e.setAttribute("href", canvas.toDataURL("image/png"));
		e.setAttribute("x", e.dataset.middle - width / 2);
	};

	image.src = await fileToDataURL(file);
}

function render(image, width, height, button) {
	const b = button;
	const renderCanvas = document.createElement("canvas");
	const renderContext = renderCanvas.getContext("2d");
	renderCanvas.width = width;
	renderCanvas.height = height;
	renderContext.drawImage(image, 0, 0, width, height);

	URL.revokeObjectURL(image.src);

	const link = document.createElement("a");
	link.setAttribute("download", "tlop.png");
	link.setAttribute(
		"href",
		renderCanvas
			.toDataURL("image/png")
			.replace("image/png", "image/octet-stream"),
	);
	link.click();
	b.removeAttribute("disabled");
	b.textContent = "Download Image";
}

function save(button, retried = false) {
	const b = button;
	b.textContent = "...";
	b.setAttribute("disabled", true);

	const renderImage = new Image();

	document.querySelectorAll("svg input").forEach((e) => {
		e.setAttribute("value", e.value);
	});

	const svg = document.querySelector("svg");
	const { width } = svg.viewBox.baseVal;
	const { height } = svg.viewBox.baseVal;

	const svgURL = new XMLSerializer().serializeToString(svg);
	const svgBlob = new Blob([svgURL], { type: "image/svg+xml" });
	const objUrl = URL.createObjectURL(svgBlob);

	renderImage.onload = () => {
		if (isSafari && !retried) {
			URL.revokeObjectURL(objUrl);
			save(button, true);
			return;
		}
		render(renderImage, width, height, button);
	};

	renderImage.src = objUrl;
}

function expandHex(hex) {
	if (hex.length === 4) {
		return `#${hex
			.slice(1)
			.split("")
			.map((char) => char + char)
			.join("")}`;
	}
	return hex;
}

function updateColor(e) {
	if (!e.value.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/)) {
		return;
	}
	const color = expandHex(e.value);
	const type = e.dataset.colorType;
	document.querySelector("svg").style.setProperty(`--${type}`, color);
	document.querySelectorAll(`[data-color-type=${type}]`).forEach((i) => {
		const input = i;
		input.value = color;
	});
}

function setAlign(align) {
	document.querySelectorAll("button[data-align]").forEach((e) => {
		e.classList.toggle("selected", align === e.dataset.align);
	});

	document
		.querySelector("#primary-text")
		.classList.toggle("align-right", align === "right");
}

function setSvgHeight() {
	if (!isSafari) {
		return;
	}

	const svg = document.querySelector("svg");
	svg.classList.add("use-height");
	if (svg.clientWidth > svg.parentElement.clientWidth) {
		svg.classList.remove("use-height");
	}
}

async function getSvgExtras() {
	const svg = document.querySelector("svg");
	let css = await (await fetch("/resources/svg.css")).text();
	const urls = [...new Set(css.match(/(?<=url\(['"`]).*?(?=['"`]\))/gi) || [])];

	await Promise.all(
		urls.map(async (u) => {
			const font = await (await fetch(u)).blob();
			const base64 = await fileToDataURL(font);
			css = css.replaceAll(u, base64);
		}),
	);

	const style = document.createElement("style");
	style.textContent = css;
	svg.appendChild(style);
}

async function getImages() {
	const filenames = ["image0.jpg", "image1.jpg"];
	await Promise.all(
		filenames.map(async (f, i) => {
			const image = await (await fetch(`/resources/images/${f}`)).blob();
			updateImage({ files: [image] }, i);
		}),
	);
}

document.addEventListener("DOMContentLoaded", () => {
	setSvgHeight();
	getSvgExtras();
	getImages();
	document.querySelectorAll("input[data-text]").forEach(updateText);
});

document.addEventListener("change", (e) => {
	const t = e.target;

	if (t.dataset.colorType) {
		updateColor(t);
	} else if (t.dataset.image) {
		updateImage(t, t.dataset.image);
	} else if (t.id === "toggle-quaternary") {
		t.parentElement.querySelector("input").disabled = !t.checked;
	}
});

document.addEventListener("click", (e) => {
	const t = e.target;

	switch (t.id) {
		case "save-button":
			save(t);
			break;
		default:
			break;
	}

	if (t.dataset.align) {
		setAlign(t.dataset.align);
	}
});

document.addEventListener("dragover", (e) => {
	e.preventDefault();
});

document.addEventListener("drop", (e) => {
	e.preventDefault();
	const t = e.target;

	if (t.dataset.image) {
		updateImage(e.dataTransfer, t.dataset.image);
	}
});

document.addEventListener("keyup", (e) => {
	const t = e.target;
	if (!t.dataset.text) {
		return;
	}

	updateText(t);
});

window.addEventListener("resize", setSvgHeight);
