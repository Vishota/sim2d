import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

export default class Field {
	private _sizeX: number;
	private _sizeY: number;

	private _worldBuff1: tf.Tensor3D;
	private _worldBuff2: tf.Tensor3D;
	private _reverseBuffers = false;
	private _paramsCount = 2; // temperature + pressure

	get readBuffer() {
		return this._worldBuff1//this._reverseBuffers ? this._worldBuff1 : this._worldBuff2;
	}

	get writeBuffer() {
		return this._worldBuff2// this._reverseBuffers ? this._worldBuff2 : this._worldBuff1;
	}

	constructor(sizeX: number, sizeY: number) {
		this._sizeX = sizeX;
		this._sizeY = sizeY;

		this._worldBuff1 = tf.stack([
			tf.fill([sizeX, sizeY], 1),        // temperature
			tf.randomUniform([sizeX, sizeY]),  // pressure
		], 2) as tf.Tensor3D;

		this._worldBuff2 = tf.clone(this._worldBuff1);
	}

	tick() {
		const write = tf.tidy(() => {
			const read = this.readBuffer;

			const current = getWorldLayers(read);
			const bottom = getWorldLayers(bottomNeighbor(read));
			const right = getWorldLayers(rightNeighbor(read));

			const speedTemp = 1;
			const speedPres = 1;

			const weightP_curr = tf.div(1, tf.add(1, current.temperature)).add(1);
			const weightP_right = tf.div(1, tf.add(1, right.temperature)).add(1);
			const weightP_bottom = tf.div(1, tf.add(1, bottom.temperature)).add(1);

			const weightT = 1

			const fluxX_pres = current.pressure.add(right.pressure)
				.mul(weightP_curr)
				.div(weightP_curr.add(weightP_right))
				.div(4)
				.mul(speedPres) as tf.Tensor3D;

			const fluxY_pres = current.pressure.add(bottom.pressure)
				.mul(weightP_curr)
				.div(weightP_curr.add(weightP_bottom))
				.div(4)
				.mul(speedPres) as tf.Tensor3D;

			const fluxX_temp = current.temperature.add(right.temperature)
				.mul(weightT)
				.div(weightT+1)//.add(weightT_right))
				.div(4)
				.mul(speedTemp) as tf.Tensor3D;

			const fluxY_temp = current.temperature.add(bottom.temperature)
				.mul(weightT)
				.div(weightT+1)//.add(weightT_bottom))
				.div(4)
				.mul(speedTemp) as tf.Tensor3D;

			const fluxX_temp_in = concatLeftEdge(fluxX_temp);
			const fluxY_temp_in = concatTopEdge(fluxY_temp);

			const fluxX_pres_in = concatLeftEdge(fluxX_pres);
			const fluxY_pres_in = concatTopEdge(fluxY_pres);
			
			console.log(
				'<fluxX_temp>',
				tf.sum(fluxX_temp).arraySync(),
				'\n\n',
				tf.sum(fluxX_temp_in).arraySync(),
			)
			console.log(
				'<fluxY_temp>',
				tf.sum(fluxY_temp).arraySync(),
				'\n\n',
				tf.sum(fluxY_temp_in).arraySync(),
			)
			console.log(
				'<fluxY_pres>',
				tf.sum(fluxY_pres).arraySync(),
				'\n\n',
				tf.sum(fluxY_pres_in).arraySync(),
			)

			const tempNext = current.temperature
				.add(fluxX_temp_in).add(fluxY_temp_in)
				.sub(fluxX_temp).sub(fluxY_temp);

			const presNext = current.pressure
				.add(fluxX_pres_in).add(fluxY_pres_in)
				.sub(fluxX_pres).sub(fluxY_pres);

			return tf.concat([tempNext, presNext], 2);
		}) as tf.Tensor3D;

		// safe swap
		if (this._reverseBuffers) {
			this._worldBuff1.dispose();
			this._worldBuff1 = write;
		} else {
			this._worldBuff2.dispose();
			this._worldBuff2 = write;
		}

		this._reverseBuffers = !this._reverseBuffers;
	}

	render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, scale: number) {
		const read = this.readBuffer; // keep reference outside tidy

		tf.tidy(() => {
			const startX = Math.floor(cameraX);
			const startY = Math.floor(cameraY);
			const viewW = 1000;
			const viewH = 1000;
			if (viewW <= 0 || viewH <= 0) return;

			const cropped = read.slice([startX, startY, 0], [viewW, viewH, 2]);
			// const min = cropped.min();
			// const max = cropped.max();

			const term = cropped.slice([0, 0, 0], [viewW, viewH, 1])
			const pres = cropped.slice([0, 0, 1], [viewW, viewH, 1])

			const tempNorm = term.abs().div(term.abs().add(1)).clipByValue(0, 1);
			const presNorm = pres.abs().div(pres.abs().add(1)).clipByValue(0, 1);
			// const presNorm = cropped.slice([0, 0, 1], [viewW, viewH, 1])
			// 	.sub(min).div(max.sub(min).add(1e-8)).mul(255).toInt();

			const tempNorm2D = tempNorm.squeeze([2]);
			const presNorm2D = presNorm.squeeze([2]);
			const zeros = tf.zeros([viewW, viewH], 'float32');

			if(Math.random()>.99) console.log(tempNorm2D.toString())

			const rgba = tf.stack([tempNorm2D, zeros, presNorm2D], 2) as tf.Tensor3D;

			tf.browser.toPixels(rgba, ctx.canvas);
		});
	}

	debug() {
		const part = this.readBuffer.slice([0,0], [10,10]).arraySync()
		console.log(part.map(x=>x.map(y => y[1]).join()).join('\n'))


	}
}

// --- Helper functions ---
function getWorldLayers(tensor: tf.Tensor3D) {
	return getWorldLayersDynamic(tensor, ['temperature', 'pressure']);
}

function getWorldLayersDynamic(tensor: tf.Tensor3D, names: string[]) {
	const layers: Record<string, tf.Tensor3D> = {};
	names.forEach((name, i) => {
		layers[name] = tensor.slice([0, 0, i], [-1, -1, 1]);
	});
	return layers;
}

function concatLeftEdge(tensor: tf.Tensor3D) {
	const [W, H, C] = tensor.shape;
	const left = tensor.slice([W - 1, 0, 0], [1, H, C]);
	const body = tensor.slice([0, 0, 0], [W - 1, H, C]);
	return tf.concat([left, body], 0);
}

function concatTopEdge(tensor: tf.Tensor3D) {
	const [W, H, C] = tensor.shape;
	const top = tensor.slice([0, H - 1, 0], [W, 1, C]);
	const body = tensor.slice([0, 0, 0], [W, H - 1, C]);
	return tf.concat([top, body], 1);
}

function topNeighbor(t: tf.Tensor3D): tf.Tensor3D {
	const [X, Y, C] = t.shape;
	return tf.concat([
		t.slice([0, Y - 1, 0], [X, 1, C]),
		t.slice([0, 0, 0], [X, Y - 1, C])
	], 1);
}

function bottomNeighbor(t: tf.Tensor3D): tf.Tensor3D {
	const [X, Y, C] = t.shape;
	return tf.concat([
		t.slice([0, 1, 0], [X, Y - 1, C]),
		t.slice([0, 0, 0], [X, 1, C])
	], 1);
}

function leftNeighbor(t: tf.Tensor3D): tf.Tensor3D {
	const [X, Y, C] = t.shape;
	return tf.concat([
		t.slice([X - 1, 0, 0], [1, Y, C]),
		t.slice([0, 0, 0], [X - 1, Y, C])
	], 0);
}

function rightNeighbor(t: tf.Tensor3D): tf.Tensor3D {
	const [X, Y, C] = t.shape;
	return tf.concat([
		t.slice([1, 0, 0], [X - 1, Y, C]),
		t.slice([0, 0, 0], [1, Y, C])
	], 0);
}
