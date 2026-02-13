export default `
struct GlobalUniforms {
  frame_index: u32,
};

@group(0) @binding(0) var<uniform> globals: GlobalUniforms;

@group(0) @binding(1) var<storage, read_write> data: array<f32>;


@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( -1,  -1),  
    vec2f(-1, 1),  
    vec2f( 1, 1),   
    vec2f(1, -1),
    vec2f( -1,  -1),
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment fn fs(@builtin(position) pixelPosition : vec4f) -> @location(0) vec4f {
  let a = f32(globals.frame_index) / 100;
  return vec4f(pixelPosition.x / 500, pixelPosition.y / 500, (sin(a)+1)/2, 1.0);

}

@compute fn calc() {

}
`