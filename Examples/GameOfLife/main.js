// Information from https://codelabs.developers.google.com/your-first-webgpu-app#3
// Written by Max K

console.log("main.js loaded")

const GRID_SIZE = 256;

// Lets check if WebGPU is available on the user's browser
if (!navigator.gpu) {
    throw new Error("The User does not have WebGPU!")
};

// Get an GPUAdaptor that serves as an point to access the GPU
const adapter = await navigator.gpu.requestAdapter()
if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.")
}

// Lets now get the GPUDevice through the adaptor
const device = await adapter.requestDevice(); // More options can be passed here, for req. higher limits for example.

// Set up the canvas
const canvas = document.querySelector("canvas");
const context = canvas.getContext("webgpu");
//Initialise the canvas
canvas.width = 1000;
canvas.height = 1000;

// set the canvas format
console.log();
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device: device, // What device im going to use the context with
    format: canvasFormat // The texture format the context should use
});

// --------------------------Buffers--------------------------------

// Get the Vertices for rendering. This is 2 triangles to make a square
const vertices = new Float32Array([
    // X,   Y,
    -1, -1, // Triangle 1 
    1, -1,
    1, 1,

    -1, -1, // Triangle 2 
    1, 1,
    -1, 1,
]);
// Create a GPUBuffer object to give the vertex data to the GPU memory
const vertexBuffer = device.createBuffer({
    label: "Cell vertices", // Giving the buffer a label will help with understanding errors
    size: vertices.byteLength, // 48 bytes, 32-bit float (4 bytes) * number of vertices in the array (12)  
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // Two of the https://gpuweb.github.io/gpuweb/#buffer-usage/ (the bitwise OR symbol |  )
});
//Add the vertex data into the vertexBuffer's memory
device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/0, vertices);
//We need to tell the gpu what is the layout of the GPUBuffer object. The format is https://gpuweb.github.io/gpuweb/#dictdef-gpuvertexbufferlayout
const vertexBufferLayout = {
    arrayStride: 8, // How much to skip forward to get to the next vertex. a 32bit float is 4 bytes therefore 2 of them is 8 bytes
    attributes: [{ // This one will only contain the position of the vertex, but could be colour, and direction
        format: "float32x2", // https://gpuweb.github.io/gpuweb/#enumdef-gpuvertexformat
        offset: 0, // How many bytes into this vertex this attribute starts
        shaderLocation: 0, // Position, see vertex shader (arbitrary between 0 and 15)
    }],
};

// Create a uniform buffer that describes the grid.
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]); // Could use an Uint32Array() but would be casting floats in several places anyway.
const uniformBuffer = device.createBuffer({
  label: "Grid Uniforms",
  size: uniformArray.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE); // Representing the active state of each cell.
const cellStateBuffers = [
    device.createBuffer({
        label: "Storage Buffer (Cell State A)",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, // Defince this to make sure WebGPU knows its a General Storage Buffer
    }),
    device.createBuffer({
        label: "Storage Buffer (Cell State B)",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, // Defince this to make sure WebGPU knows its a General Storage Buffer
    }),
]

for (let i = 0; i < cellStateArray.length; i++) {
    cellStateArray[i] = Math.random() > 0.92 ? 1 : 0; // A random value from 0 to 1 is greater than 0.6, if so set 1, if not set 0
}
device.queue.writeBuffer(cellStateBuffers[0], 0, cellStateArray); // Saving on memory!



// ---------------------------------------------------------------

//Creating a Shader, Returns an GPUShaderModule obect with the compiled results (https://gpuweb.github.io/gpuweb/#gpushadermodule)
const cellShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: /* wgsl */`
        @group(0) @binding(0) var<uniform> grid: vec2f; // 2D float vector 
        @group(0) @binding(1) var<storage> cellState: array<u32>; // var type is storage to be able to read it. Give the cell state an array of u32 to match the JavaScript.

        struct VertexInput {
            @location(0) pos: vec2f,
            @builtin(instance_index) instance: u32,
        };
          
        struct VertexOutput {
            @builtin(position) pos: vec4f,
            @location(0) cell: vec2f,
        };

        @vertex // Defines what scope the function is
        fn vertexMain(input: VertexInput) -> VertexOutput { //Must at least return the final position being processed in clip space.
            let i = f32(input.instance); // Convert it to a float 32-bit, known as casting the type
            // Compute the cell coordinates from the instance_index.
            let cell = vec2f(i % grid.x, floor(i / grid.y)); // For each X val, want the instance_index modulo grid width. and for the Y value fractional discarded, instance_index / grid width.
            let state = f32(cellState[input.instance]);

            let cellOffset = cell / grid * 2; // Compute the offset of the cell, 
            let gridPos = (input.pos*state + 1) / grid - 1 + cellOffset; // Adds 1 to each component of pos in clip space before being divided by the grid size.

            var output: VertexOutput;
            output.pos = vec4f(gridPos, 0, 1);
            output.cell = cell;
            return output; // (X, Y, Z, W) (W used for 4x4 matrices)
        }

        struct FragInput{
            @location(0) cell: vec2f,
        }

        @fragment
        fn fragmentMain(input: FragInput) -> @location(0) vec4f { // Returned vec4f is a colour not position. The location(0) indicated what colorAttachment from the beginRenderPass call is written to.
            let cellColourRel = input.cell/grid;
            return vec4f(cellColourRel, 1 - cellColourRel.y, 1); // Red, green, blue, Alpha
        }
    `
});


const WORKGROUP_SIZE = 8
const cellSimulationShader = device.createShaderModule({
    label: "Simulation Shader",
    code:  /* wgsl */ `
        @group(0) @binding(0) var<uniform> grid: vec2f;
        
        @group(0) @binding(1) var<storage> cellStateIn: array<u32>;
        @group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>;

        fn cellIndex(cell: vec2u) -> u32 {
            return (cell.y % u32(grid.y)) * u32(grid.x) + (cell.x % u32(grid.x));
        }

        fn cellActive(cell: vec2u) -> u32 {
            return cellStateIn[cellIndex(cell)];
        }

        @compute 
        @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
        fn computeFunc(@builtin(global_invocation_id) cell: vec3u) { //Vector 3 of unsinged integers, where in the grid of shader invocations i am.
            // Determine how many active neighbors this cell has
            let cell2D = vec2u(cell.xy); // Swizzling!
            let activeNeighbors = cellActive(cell2D + vec2u(1, 1)) +
                                    cellActive(cell2D + vec2u(1,0)) +
                                    cellActive(cell2D + vec2u(1, 0) - vec2u(0, 1)) +
                                    cellActive(cell2D - vec2u(0, 1)) +
                                    cellActive(cell2D - vec2u(1, 1)) +
                                    cellActive(cell2D - vec2u(1, 0)) +
                                    cellActive(cell2D - vec2u(1, 0) + vec2u(0, 1)) +
                                    cellActive(cell2D + vec2u(0, 1));
            let i = cellIndex(cell2D); // Get the current cell position from 2D to 1D line
            switch (activeNeighbors) {
                case 2: { // Active cells with 2 neighbors stay alive
                    cellStateOut[i] = cellStateIn[i];
                }
                case 3: { // 3 or more neighbors stay alive
                    cellStateOut[i] = 1;
                }
                default: { // Cells with less than 2 or greater than 3 neighbors become inactive
                    cellStateOut[i] = 0;
                }
            };

            
        }
    `
})

// Bind group layout
const bindGroupLayout = device.createBindGroupLayout({
    label: "Cell Bind Group Layout",
    entries: [
        {   
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: {} // Grid uniform buffer
            // Other options are texture and sampler.
        },
        {
            binding: 1,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage"} // Cell state input buffer
        },
        {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage"} // Cell State output buffer
        }
    ],
});

// Pipeline Layout
const pipelineLayout = device.createPipelineLayout({
    label: "Cell Pipeline Layout",
    bindGroupLayouts: [bindGroupLayout],
});


// Render Pipeline
const cellPipeline = device.createRenderPipeline({
    label: "Cell pipeline",
    layout: pipelineLayout, // What types of inputs (Other than vertex buffers)
    vertex: {
        module: cellShaderModule, // GPUShaderModule
        entryPoint: "vertexMain", // Name of the function for every vertex invocation
        buffers: [vertexBufferLayout] // Array of GPUVertexBufferLayout, 
    },
    fragment: {
        module: cellShaderModule,
        entryPoint: "fragmentMain",
        targets: [{ // Array of dictionaries, such as texture format, colorAttachments 
            format: canvasFormat 
        }]
    }
});

// Compute Pipeline
const simulationPipeline = device.createComputePipeline({
    label: "Simulation Pipeline",
    layout: pipelineLayout, // Ensure Both render and compute pipelines use same bind groups
    compute: {
        module: cellSimulationShader, // Where's the shader code
        entryPoint: "computeFunc" // Main function
    }
})

// Bind Group returns a https://gpuweb.github.io/gpuweb/#gpubindgroup
const bindGroups = [
    device.createBindGroup({
        label: "Cell Renderer Bind Group A",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        },{
            binding: 1,
            resource: { buffer: cellStateBuffers[0] }
        },{
            binding: 2,
            resource: { buffer: cellStateBuffers[1]}
        }],
    }),
    device.createBindGroup({
        label: "Cell Renderer Bind Group B",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: {buffer: uniformBuffer}
        },{
            binding: 1,
            resource: {buffer: cellStateBuffers[1]}
        }, {
            binding: 2,
            resource: {buffer: cellStateBuffers[0]}
        }]
    })
];

// Rendering Loop
const UPDATE_INTERVAL = 64; //ms, 5 times a second
let step = 0; // Track how many simulation steps have been run
function UpdateGrid() {
    
    // Clear the canvas with a solid colour
    // Have the device create a GPUCommandEncoder, which provides an interface for recording GPU commands
    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();

    computePass.setPipeline(simulationPipeline);
    computePass.setBindGroup(0, bindGroups[step % 2])

    const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCount, workgroupCount); // NOT the number of invocations, instead number of workgroups to execute, as defined by the @workgroup_size in the shader
    // If you want the shader to execute 32 times and workgroup size is 8, then i need to dispatch 4 x 4 workgroups (4* 8 = 32)
    computePass.end();

    step++; // Increment the step count

    // Since the commands we want to sent to the GPU are related to rendering,
    // (Clearing Canvas) we want to use this encoder to begin a render pass
    // Call the render pass, which defines the textures that reveive the output of any drawing commands.
    const renderPass = encoder.beginRenderPass({// Returns a texture with a pixel width and height matching the canvas's attributes and the same format as above
        colorAttachments: [{
            view: context.getCurrentTexture()/* Render Passes require a GPUTextureView instead of GPUTexture */.createView()/* Since no Arguments, Indicates want render pass to use entire texture */,
            // We have to specify what we want the render pas to do with the texture when it starts and ends
            loadOp: "clear", //Indicates want texture to be cleared on start
            clearValue: [0,0,0,1], // r, g, b, a
            storeOp: "store" // Indicates that once the render pass completes, the results of the drawing during the render pass, gets saved into the texture
        }]
    }) 

    renderPass.setPipeline(cellPipeline); // Shaders that are used ect.
    renderPass.setVertexBuffer(0, vertexBuffer); // 0th element in the vertex.buffers definition

    renderPass.setBindGroup(0, bindGroups[step % 2]); // What group and bind group.

    renderPass.draw(vertices.length/2, GRID_SIZE * GRID_SIZE); // 6 vertices. The second argument is how many instances
    renderPass.end(); // Ends the render pass
    // Note that making these calls to the methods do not instruct the GPU to enact, their just recording commands

    const commandBuffer = encoder.finish() // Create a GPUCommandBuffer which is an opauqe handle to the recorded commands.
    device.queue.submit([commandBuffer]); // Submit the GPUCommandBuffer to the GPU, the .submit() method takes in an array of commandBuffers
    // Usually are merged above because the commandBuffer can not be used again.
}

//Schedule UpdateGrid to run repeatedely
setInterval(UpdateGrid, UPDATE_INTERVAL);