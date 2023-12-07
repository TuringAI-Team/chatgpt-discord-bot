import { createCanvas, loadImage, Image } from "canvas";
import sharp from "sharp";
export async function mergeImages(imgs: string[], width: number = 1024, height: number = 1024) {
	var totalW = width * 2;
	var totalH = height * 2;

	if (imgs.length == 1) {
		totalW = totalW / 2;
		totalH = totalH / 2;
	}
	if (imgs.length == 2) {
		totalH = totalH / 2;
	}
	var canvas = createCanvas(totalW, totalH);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	for (var i = 0; i < imgs.length; i++) {
		var im = await sharp(imgs[i])
			.toFormat("png")
			.toBuffer();
		var b64 = Buffer.from(im).toString("base64");
		const img = new Image();
		var x = 0;
		var y = 0;
		if (i == 0) {
			x = 0;
			y = 0;
		}
		if (i == 1) {
			x = width;
			y = 0;
		}
		if (i == 2) {
			x = 0;
			y = height;
		}
		if (i == 3) {
			x = width;
			y = height;
		}
		img.onload = () => ctx.drawImage(img, x, y, width, height);
		img.onerror = (err) => {
			throw err;
		};
		img.src = `data:image/png;base64,${b64}`;
	}

	const dataURL = canvas.toDataURL();
	return dataURL;
}
