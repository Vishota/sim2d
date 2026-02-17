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
        // uniData[0] = 100
        uniData[55] = 100
        // uniData[99] = 100

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
        pass.dispatchWorkgroups(10, 10);

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

            let outString = ''

            result.forEach((x, i) => {
                outString += x.toString().padStart(10) + ((i + 1) % 10 - 0 ? '' : '\n');
            })

            console.log(outString)

            readBuffer.unmap();


        });




    }
    async run2() {
        const size = 400;

        // -----------------------------
        // 1️⃣ INITIAL UNIFORM
        // -----------------------------
        const uniformBuffer = this._device.createBuffer({
            size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const initialData = new Float32Array(100);
        initialData[55] = 100;

        this._device.queue.writeBuffer(uniformBuffer, 0, initialData);

        // -----------------------------
        // 2️⃣ STORAGE BUFFER (FIRST PASS)
        // -----------------------------
        const storageBuffer = this._device.createBuffer({
            size,
            usage:
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.COPY_SRC |
                GPUBufferUsage.COPY_DST
        });

        const layout = this._pipeline.getBindGroupLayout(0);

        const bindGroup = this._device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: { buffer: storageBuffer } }
            ]
        });

        // -----------------------------
        // 3️⃣ FIRST DISPATCH
        // -----------------------------
        const encoder = this._device.createCommandEncoder();
        const pass = encoder.beginComputePass();

        pass.setPipeline(this._pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(10, 10);
        pass.end();

        const readBuffer = this._device.createBuffer({
            size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        encoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, size);
        this._device.queue.submit([encoder.finish()]);

        // -----------------------------
        // 4️⃣ MAP + LOG FIRST RESULT
        // -----------------------------
        await readBuffer.mapAsync(GPUMapMode.READ);

        const mapped1 = readBuffer.getMappedRange();
        const result1 = new Float32Array(mapped1);

        console.log("FIRST PASS RESULT:");
        logMatrix(result1);

        const cpuCopy = new Float32Array(result1);
        readBuffer.unmap();

        // -----------------------------
        // 5️⃣ SECOND PASS SETUP
        // -----------------------------
        const secondUniformBuffer = this._device.createBuffer({
            size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this._device.queue.writeBuffer(secondUniformBuffer, 0, cpuCopy);

        const secondStorageBuffer = this._device.createBuffer({
            size,
            usage:
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.COPY_SRC |
                GPUBufferUsage.COPY_DST
        });

        const secondBindGroup = this._device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: { buffer: secondUniformBuffer } },
                { binding: 1, resource: { buffer: secondStorageBuffer } }
            ]
        });

        // -----------------------------
        // 6️⃣ SECOND DISPATCH
        // -----------------------------
        const encoder2 = this._device.createCommandEncoder();
        const pass2 = encoder2.beginComputePass();

        pass2.setPipeline(this._pipeline);
        pass2.setBindGroup(0, secondBindGroup);
        pass2.dispatchWorkgroups(10, 10);
        pass2.end();

        const readBuffer2 = this._device.createBuffer({
            size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        encoder2.copyBufferToBuffer(
            secondStorageBuffer,
            0,
            readBuffer2,
            0,
            size
        );

        this._device.queue.submit([encoder2.finish()]);

        // -----------------------------
        // 7️⃣ MAP + LOG SECOND RESULT
        // -----------------------------
        await readBuffer2.mapAsync(GPUMapMode.READ);

        const mapped2 = readBuffer2.getMappedRange();
        const result2 = new Float32Array(mapped2);

        console.log("SECOND PASS RESULT:");
        logMatrix(result2);

        readBuffer2.unmap();
    }



}

// Helper logger
function logMatrix(data: Float32Array) {
    let out = '';
    data.forEach((x, i) => {
        out += x.toString().padStart(10);
        if ((i + 1) % 10 === 0) out += '\n';
    });
    console.log(out);
}