import Solver from "./Solver";
import World from "./World";

const code = `
const fieldX = 10;
const fieldY = 10;

@group(0) @binding(0) var<uniform> uni: array<f32, 100>;
@group(0) @binding(1) var<storage, read_write> stor: array<f32>;

@compute @workgroup_size(10,10)
fn calc(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;

    let cur = uni[id2d(id.x, id.y, fieldX, fieldY)];

    let top		= uni[id2d(id.x, id.y - 1, fieldX, fieldY)];
    let bottom	= uni[id2d(id.x, id.y + 1, fieldX, fieldY)];
    let left	= uni[id2d(id.x - 1, id.y, fieldX, fieldY)];
    let right	= uni[id2d(id.x + 1, id.y, fieldX, fieldY)];
    
    
    stor[id2d(id.x, id.y, fieldX, fieldY)] = (cur + top + bottom + left + right) / 5;
}

fn id2d(x: u32, y: u32, xSize: u32, ySize: u32) -> u32 {
    let xNorm = x % xSize;
    let yNorm = y % ySize;
	let id = yNorm * xSize + xNorm;

    return id;
}


`

const world = await World.create({
    size: [100,100]
})

world.loop()

const solver = await Solver.create({code})

solver.run2()