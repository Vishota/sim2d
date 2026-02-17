async function createCanvas(device: GPUDevice) {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;

    const context = canvas.getContext('webgpu')!;

    canvas.width = 100;
    canvas.height = 100;

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: presentationFormat,
    });

    return { context, presentationFormat }
}


export default class World {
    private _reverseBuffers = false
    private _rendered = 0
    private _ticked = 0

    constructor(
        private _device: GPUDevice,
        private _size: [number, number],
        private _bindGroupA: GPUBindGroup,
        private _bindGroupB: GPUBindGroup,
        private _canvasData: Awaited<ReturnType<typeof createCanvas>>,
        private _tickPipeline: GPUComputePipeline,
        private _renderPipeline: GPURenderPipeline,

    ) { }

    static async create(args: {
        size: [number, number]
    }) {
        const adapter = (await navigator.gpu.requestAdapter())!;
        const device = (await adapter.requestDevice())!

        const { size } = args;

        const code = `
const WIDTH: u32 = ${size[0]};
const HEIGHT: u32 = ${size[1]};

@group(0) @binding(0) var<storage, read> current: array<f32>;
@group(0) @binding(1) var<storage, read_write> next: array<f32>;

@compute @workgroup_size(16,16,1)
fn tick (
    @builtin(global_invocation_id) id: vec3<u32>
) {
    let cur = current[id2d(id.x, id.y, WIDTH, HEIGHT)];

    let top		= current[id2d(id.x, id.y - 1, WIDTH, HEIGHT)];
    let bottom	= current[id2d(id.x, id.y + 1, WIDTH, HEIGHT)];
    let left	= current[id2d(id.x - 1, id.y, WIDTH, HEIGHT)];
    let right	= current[id2d(id.x + 1, id.y, WIDTH, HEIGHT)];
    
    next[id2d(id.x, id.y, WIDTH, HEIGHT)] = (cur + top + bottom + left + right) / 5;
}

fn id2d(x: u32, y: u32, xSize: u32, ySize: u32) -> u32 {
    let xNorm = x % xSize;
    let yNorm = y % ySize;
	let id = yNorm * xSize + xNorm;

    return id;
}

@vertex
fn vert(@builtin(vertex_index) vertexIndex : u32)
    -> @builtin(position) vec4<f32> {

    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -3.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 3.0,  1.0)
    );

    let pos = positions[vertexIndex];
    return vec4<f32>(pos, 0.0, 1.0);
}

@fragment
fn frag(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
    let x = u32(pos.x);
    let y = u32(pos.y);

    if (x >= WIDTH || y >= HEIGHT) {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    let index = y * WIDTH + x;
    let value = sigm(current[index]);

    return vec4<f32>(.9 - value * .7, .8 - value * .7, .8 - value * .7, 1.0);
}

fn sigm(x: f32) -> f32 {
    return x / (1.0 + abs(x));
}
`

        const module = device.createShaderModule({
            code: code
        })

        const canvasData = await createCanvas(device)

        const sharedLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" }
                }
            ]
        });
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [sharedLayout]
        });


        // compute
        const fieldBufferA = device.createBuffer({
            size: size[0] * size[1] * 4,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        })
        const fieldBufferB = device.createBuffer({
            size: size[0] * size[1] * 4,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        })

        const bindGroupA = device.createBindGroup({
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: fieldBufferA
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: fieldBufferB
                    }
                }
            ],
            layout: sharedLayout
        })
        const bindGroupB = device.createBindGroup({
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: fieldBufferB
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: fieldBufferA
                    }
                }
            ],
            layout: sharedLayout
        })


        setInterval(() => {
            const data = new Float32Array([1000])
            const cellCount = size[0] * size[1];
            const elementIndex = Math.floor(Math.random() * cellCount);
            const offset = elementIndex * 4;

            device.queue.writeBuffer(fieldBufferA, offset, data);
            device.queue.writeBuffer(fieldBufferB, offset, data);
        }, 3350)

        const tickPipeline = device.createComputePipeline({
            compute: {
                module,
                entryPoint: 'tick'
            },
            layout: pipelineLayout
        })

        // render
        const renderPipeline = device.createRenderPipeline({
            vertex: {
                module,
                entryPoint: 'vert'
            },
            fragment: {
                module,
                entryPoint: 'frag',
                targets: [
                    {
                        format: canvasData.presentationFormat
                    }
                ]
            },
            layout: pipelineLayout
        })

        return new World(
            device,
            size,
            bindGroupA,
            bindGroupB,
            canvasData,
            tickPipeline,
            renderPipeline
        )
    }

    private tick() {
        this._ticked++

        const commandEncoder = this._device.createCommandEncoder()
        const pass = commandEncoder.beginComputePass()
        pass.setPipeline(this._tickPipeline)
        pass.setBindGroup(0, this._reverseBuffers ? this._bindGroupA : this._bindGroupB)
        pass.dispatchWorkgroups(
            Math.ceil(this._size[0]),
            Math.ceil(this._size[1])
        )
        pass.end()

        this._reverseBuffers = !this._reverseBuffers

        this._device.queue.submit([commandEncoder.finish()]);
    }

    private render() {
        this._rendered++

        const commandEncoder = this._device.createCommandEncoder()

        const view = this._canvasData.context.getCurrentTexture().createView();
        const renderPass: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        const passEncoderRender = commandEncoder.beginRenderPass(renderPass);
        passEncoderRender.setPipeline(this._renderPipeline);
        passEncoderRender.setBindGroup(0, this._reverseBuffers ? this._bindGroupA : this._bindGroupB);
        passEncoderRender.draw(3, 1);
        passEncoderRender.end();

        this._device.queue.submit([commandEncoder.finish()]);
    }

    loop() {
        const computeLoop = () => {
            this.tick()
            setTimeout(() => computeLoop(),0)
        }
        const renderLoop = () => {
            this.render()
            requestAnimationFrame(() => renderLoop())
        }

        computeLoop()
        renderLoop()
    }

    runDebug() {
        const start = performance.now()

        setInterval(() => {
            const now = performance.now()
            console.log({
                rendered: this._rendered,
                ticked: this._ticked,
                performanceCompute: this._ticked / (now - start)
            })
        }, 1000)
    }
}
