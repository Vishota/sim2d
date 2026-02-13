export default class Solver {
    constructor(
        private _adapter: GPUAdapter,
        private _device: GPUDevice,
        private _code: string,
        private _module: GPUShaderModule,
        private _pipeline: GPUComputePipeline
    ) {

    }

    static async create(parameters: {
        code: string
    }) {
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) throw new Error('Adapter not fount')
        const device = await adapter.requestDevice()
        if (!device) throw new Error('Device not fount')

        const module = device.createShaderModule({
            code: parameters.code
        })

        const pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module,
                entryPoint: 'calc'
            }
        })

        return new Solver(adapter, device, parameters.code, module, pipeline)
    }

    async run() {
        const encoder = this._device.createCommandEncoder();
        const pass = encoder.beginComputePass()
        const layout = this._pipeline.getBindGroupLayout(0)
        // const layout = this._device.createBindGroupLayout({
        //     entries: [
        //         {
        //             binding: 0,
        //             visibility: GPUShaderStage.COMPUTE,
        //             buffer: {
        //                 type: 'uniform',
        //             }
        //         },
        //         {
        //             binding: 1,
        //             visibility: GPUShaderStage.COMPUTE,
        //             buffer: {
        //                 type: 'storage'
        //             }
        //         }
        //     ]
        // })
        const uniformResource = this._device.createBuffer({
            size: 100 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        const uniData = new Float32Array(100)
        uniData[0] = 100
        uniData[50] = 33
        uniData[99] = 11

        this._device.queue.writeBuffer(uniformResource, 0, uniData.buffer)


        const storageBuffer = this._device.createBuffer({
            size: 400,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        })

        const bind = this._device.createBindGroup({
            layout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformResource
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: storageBuffer
                    }
                }
            ]
        })


        pass.setPipeline(this._pipeline)
        pass.setBindGroup(0, bind)
        pass.dispatchWorkgroups(100);

        const readBuffer = this._device.createBuffer({
            size: 400,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        pass.end();
        encoder.copyBufferToBuffer(
            storageBuffer,
            0,
            readBuffer,
            0,
            400
        )
        
        this._device.queue.submit([encoder.finish()])

        await readBuffer.mapAsync(GPUMapMode.READ).then(() => {
            const data = readBuffer.getMappedRange();
            const result = new Float32Array(data);
            console.log(result.join(), result.length)
            readBuffer.unmap();
        });
    }
}