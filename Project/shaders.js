export { shaderCode };

const shaderCode = /* wgsl */`
@group(1) @binding(0) var<uniform> objPosition: vec2f;

struct Output {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};
struct Input {
    @location(0) vertexPos: vec2f,
};

@vertex
fn vertMain(input: Input) -> Output {
    var vs_out: Output;
    // Set the position of the vertex
    vs_out.position = vec4<f32>(input.vertexPos+objPosition, 0, 5);
    // Set the color of the vertex
    vs_out.color = vec3<f32>(0.0, 0.0, 0.0);
    return vs_out;
}

struct FragInput{
    @location(0) cell: vec2f,
}

@fragment
fn fragMain(@location(0) in_color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(in_color, 1.0);
}
`