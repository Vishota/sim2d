import Solver from "./Solver";

const code = `
@group(0) @binding(0) var<uniform> uni: array<f32, 100>;
@group(0) @binding(1) var<storage, read_write> stor: array<f32>;

@compute @workgroup_size(10)
fn calc(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    let a = uni[i];
    stor[i] = f32(id.x + id.y * 10000 + id.z * 100000000);
}


`

const solver = await Solver.create({code})

solver.run()