import Field from './Field';
import Core from './Core';
import * as tf from '@tensorflow/tfjs';


// 1️⃣ Create simulation field
const fieldWidth = 1500;  // number of cells in X
const fieldHeight = 1500; // number of cells in Y
const field = new Field(fieldWidth, fieldHeight);

// 2️⃣ Create Core to handle canvas, camera, input, and loop
const core = new Core(field, {
    scale: 1,      // initial pixels per cell
    tickSpeed: 1  // ~60 FPS
});
setInterval(() => field.debug(), 1000)
// 3️⃣ The Core class already starts the loop, so nothing else is needed

console.log('Simulation started! Use WASD to pan, +/- to zoom.');

window.addEventListener('beforeunload', () => {
    try {
        // Dispose all variables (models, weights)
        tf.disposeVariables();

        // Reset the backend to free GPU memory
        tf.engine().reset();

        console.log('TensorFlow.js memory cleared before reload.');
    } catch (err) {
        console.warn('Error clearing TF memory:', err);
    }
});