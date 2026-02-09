import Field from './Field';

interface CoreOptions {
    width?: number;
    height?: number;
    scale?: number;   // initial pixels per cell
    tickSpeed?: number; // ms per tick
}

export default class Core {
    public canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private field: Field;

    private cameraX = 0;
    private cameraY = 0;
    private scale: number;
    private tickSpeed: number;

    private keys: Record<string, boolean> = {};

    constructor(field: Field, options: CoreOptions = {}) {
        this.field = field;
        this.scale = options.scale ?? 4;
        this.tickSpeed = options.tickSpeed ?? 16;

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = options.width ?? window.innerWidth;
        this.canvas.height = options.height ?? window.innerHeight;
        document.body.appendChild(this.canvas);
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context not available');
        this.ctx = ctx;

        // Event listeners
        this.setupInput();
        window.addEventListener('resize', this.onResize);


        // Start loop
        requestAnimationFrame(this.loop);
    }

    private setupInput() {
        window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
    }

    private onResize = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    };

    private updateCamera() {
        const speed = 5 / this.scale; // move faster if zoomed out
        if (this.keys['w']) this.cameraY -= speed;
        if (this.keys['s']) this.cameraY += speed;
        if (this.keys['a']) this.cameraX -= speed;
        if (this.keys['d']) this.cameraX += speed;

        if (this.keys['+'] || this.keys['=']) this.scale *= 1.05;
        if (this.keys['-']) this.scale /= 1.05;

        // Clamp camera to field bounds
        // const maxX = this.field['_sizeX'] - this.canvas.width / this.scale;
        // const maxY = this.field['_sizeY'] - this.canvas.height / this.scale;
        // this.cameraX = Math.max(0, Math.min(this.cameraX, maxX));
        // this.cameraY = Math.max(0, Math.min(this.cameraY, maxY));
    }

    private loop = () => {
        this.updateCamera();

        this.field.tick();
        this.field.render(this.ctx, this.cameraX, this.cameraY, this.scale);

        setTimeout(() => requestAnimationFrame(this.loop), this.tickSpeed);
    };
}
