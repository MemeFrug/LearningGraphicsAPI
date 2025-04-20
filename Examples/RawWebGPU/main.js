// Written From Alain's Blog: https://alain.xyz/blog/raw-webgpu
console.log("main.js loaded");

// First I need to access WebGPU's API
const entry = navigator.gpu;
if (!entry) {
    throw new Error("WebGPU does not exist on this browser.");
}

// Get the canvas
let canvas = document.getElementById("mainCanvas");
//Initialise the canvas
canvas.width = 1920;
canvas.height = 1080;

// I need to get an adaptor 
let adapter = null; // Physical properties of a given GPU, such as its name, extensions, and device limits.
//device handle
let device = null; // How you access the core of WebGPU API, and will alow you to create the data structures you'll need
// Declare a queue handle
let queue = null; // A Queue allows work to be sent asynchronously to the GPU.
// Get Canvas Context, that manages a series of textures, used to present the final render output

let context = canvas.getContext("webgpu");
let canvasFormat = null;

// Declare attachment handles
let depthTexture = null;
let depthTextureView = null;

// Declare canvas context image handles
let colorTexture = null;
let colorTextureView = null;

// Declare buffer handles
let positionBuffer = null;
let colorBuffer = null;
let indexBuffer = null;

// Declare Command Handles
let commandEncoder = null;
let passEncoder = null;

// Render Pipeline
let pipeline = null;

//Bind Group
let uniformBindGroup = null;
let uniformBindGroupLayout = null;

async function init() {
    adapter = await entry.requestAdapter(); // Request Adapter
    if (!adapter) {
        throw new Error("GPU not found", adaptor);
    }
    device = await adapter.requestDevice(); // Request Device
    if (!device) {
        throw new Error("Logical Device not found", device);
    }
    queue = device.queue;
    if (!queue) {
        throw new Error("Queue access was not found", queue);
    }
    canvasFormat =  navigator.gpu.getPreferredCanvasFormat();

    // Configure Canvas Context
    const canvasConfig = {
        device: device,
        format: canvasFormat
    };
    
    context.configure(canvasConfig);

    
    //Frame Buffer Attachments
    // When executing different passes of the rendering system, different output textures
    // need to be written to. Depth Textures for depth and shadows, or attachments for 
    // various aspects of a deferred render such as view space normals, PBR, reflectivity etc.
    // Frame buffers attachments are references to texture views

    // Create Depth Backing GPUTextureDescriptor
    const depthTextureDesc = {
        size: [canvas.width, canvas.height, 1],
        dimension: "2d",
        format: "depth24plus-stencil8", // Format
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    }

    depthTexture = device.createTexture(depthTextureDesc);
    depthTextureView = depthTexture.createView();
    
    colorTexture = context.getCurrentTexture();
    colorTextureView = colorTexture.createView();

    /* A buffer is a array of data such as a mesh's positional data, color data, index data.
        When rendering triangles with a raster based graphics pipeline,
        youll need 1 or more buffers of vertex data (referred to as Vertex Buffer Objects or VBOs)
        1 buffer of the indices that correspond with each triangle vertex that i intend to draw (or Index Buffer Object or IBO)
    */

    //Position Vertex Buffer Data
    const positions = new Float32Array([
        1.0, -1.0, 0.0, 
        -1.0, -1.0, 0.0, 
        0.0,  1.0, 0.0,
    ]);

    //Color Vertex Buffer Data
    const colors = new Float32Array([
        1.0, 0.0, 0.0, // 🔴
        0.0, 1.0, 0.0, // 🟢
        0.0, 0.0, 1.0, // 🔵
    ]);

    // Index Buffer Data
    const indices = new Uint16Array([0, 1, 2]);


    const createBuffer = (arr, usage) => {
        let desc = {
            size: (arr.byteLength + 3) & ~3,
            usage,
            mappedAtCreation: true,
        }
        // Create Buffer
        let buffer = device.createBuffer(desc);

        const writeArray = arr instanceof Uint16Array ? new Uint16Array(buffer.getMappedRange()) : new Float32Array(buffer.getMappedRange());
        writeArray.set(arr);
        buffer.unmap();
        return buffer;
    }

    positionBuffer = createBuffer(positions, GPUBufferUsage.VERTEX);
    colorBuffer = createBuffer(colors, GPUBufferUsage.VERTEX);
    indexBuffer = createBuffer(indices, GPUBufferUsage.INDEX);

    // Vertex Shaders
    const vertModule = device.createShaderModule({code:/* wgsl */`
        struct UniformBufferObject {
            modelViewProj: mat4x4<f32>,
            primaryColor: vec4<f32>,
            accentColor: vec4<f32>,
        };

        @group(0) @binding(0)
        var<uniform> uniforms: UniformBufferObject;

        struct Output {
            @builtin(position) nds_position: vec4<f32>,
            @location(0) color: vec3<f32>,
        };
        struct Input {
            @location(0) in_pos: vec3<f32>,
            @location(1) in_color: vec3<f32>,
        };

        @vertex
        fn main(input: Input) -> Output {
            var vs_out: Output;
            // vs_out.nds_position = vec4<f32>(in_pos, 1.0);
            vs_out.color = input.in_color;
            vs_out.nds_position = uniforms.modelViewProj * vec4<f32>(input.in_pos, 1.0);
            return vs_out;
        }
    `})

    const fragModule = device.createShaderModule({code:/* wgsl */`
        @fragment
        fn main(@location(0) in_color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(in_color, 1.0);
        }
    `})

    // Uniform buffer to feed data directly into the shader module
    // Uniform Data
    const uniformData = new Float32Array([
    
        // ♟️ ModelViewProjection Matrix (Identity)
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    
        // 🔴 Primary Color
        0.9, 0.1, 0.3, 1.0,
    
        // 🟣 Accent Color
        0.8, 0.2, 0.8, 1.0,
    ]);

    //Graphics Pipeline
    // Input Assembly
    const positionAttribDesc = {
        shaderLocation: 0, // @location(0)
        offset: 0,
        format: "float32x3",
    };    
    const colorAttribDesc = {
        shaderLocation: 1, // @location(0)
        offset: 0,
        format: "float32x3",
    };
    const positionBufferDesc = {
        attributes: [positionAttribDesc],
        arrayStride: 4 * 3, //sizeof(float) * 3
        stepMode: "vertex",
    };
    const colorBufferDesc = {
        attributes: [colorAttribDesc],
        arrayStride: 4 * 3, //sizeof(float) * 3
        stepMode: "vertex",
    };

    // Depth
    const depthStencil = {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus-stencil8",
    };

    // Uniform Data
    //Bind Group Layout
    uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {},
            },
        ],
    });    
    const layout = device.createPipelineLayout({ bindGroupLayouts: [uniformBindGroupLayout] });

    // Shader Stages
    const vertex = {
        module: vertModule,
        entryPoint: "main",
        buffers: [positionBufferDesc, colorBufferDesc],
    };

    // Color/Blend State
    const colorState = {
        format: "bgra8unorm",
    };

    const fragment = {
        module: fragModule,
        entryPoint: "main",
        targets: [colorState],
    };

    // Rasterization
    const primitive = {
        frontFace: "cw",
        cullMode: "none",
        topology: "triangle-list",
    };

    pipeline = await device.createRenderPipelineAsync({
        layout: layout,
        vertex: vertex,
        fragment: fragment,
        primitive: primitive,
        depthStencil: depthStencil,
    })

    // Declare buffer handles
    let uniformBuffer = createBuffer(uniformData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    // Pipeline Layout
    uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                },
            },
        ],
    });

    //Start Rendering
    render();
}

const encodeCommands = () => {
    const renderPassDesc = {
        colorAttachments: [{
            view: colorTextureView,
            clearValue: [0, 0, 0, 1], // rgba
            loadOp: "clear",
            storeOp: "store",
        },],
        depthStencilAttachment: {
            view: depthTextureView,
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            stencilClearValue: 0,
            stencilLoadOp: "clear",
            stencilStoreOp: "store",
        },
    };
    commandEncoder = device.createCommandEncoder();

    //Encode Drawing Commands
    passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup); 
    // passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    // passEncoder.setScissorRect(0, 0, canvas.width, canvas.height);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.setVertexBuffer(1, colorBuffer);
    passEncoder.setIndexBuffer(indexBuffer, "uint16");
    passEncoder.drawIndexed(3);
    passEncoder.end();

    queue.submit([commandEncoder.finish()]);
}

const render = () => {
    // Acquire next image from context
    colorTexture = context.getCurrentTexture();
    colorTextureView = colorTexture.createView();

    //Write and submit commands to queue
    encodeCommands();

    // Next frame
    requestAnimationFrame(render);
}

await init();


