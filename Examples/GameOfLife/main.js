console.log("main.js loaded")

// Lets check if WebGPU is available on the user's browser
if (!navigator.gpu) {
    throw new Error("The User has WebGPU!")
}

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
canvas.width = 1080;
canvas.height = 1920;

// set the canvas format
console.log();
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device: device, // What device im going to use the context with
    format: canvasFormat // The texture format the context should use
});

// Clear the canvas with a solid colour
// Have the device create a GPUCommandEncoder, which provides an interface for recording GPU commands
const encoder = device.createCommandEncoder();

// Since the commands we want to sent to the GPU are related to rendering,
// (Clearing Canvas) we want to use this encoder to begin a render pass
// Call the render pass, which defines the textures that reveive the output of any drawing commands.
const renderPass = encoder.beginRenderPass({// Returns a texture with a pixel width and height matching the canvas's attributes and the same format as above
    colorAttachments: [{
        view: context.getCurrentTexture()/* Render Passes require a GPUTextureView instead of GPUTexture */.createView()/* Since no Arguments, Indicates want render pass to use entire texture */,
        // We have to specify what we want the render pas to do with the texture when it starts and ends
        loadOp: "clear", //Indicates want texture to be cleared on start
        clearValue: [0,0.2,0.4,1], // r, g, b, a
        storeOp: "store" // Indicates that once the render pass completes, the results of the drawing during the render pass, gets saved into the texture
    }]
}) 

renderPass.end(); // Ends the render pass
// Note that making these calls to the methods do not instruct the GPU to enact, their just recording commands

const commandBuffer = encoder.finish() // Create a GPUCommandBuffer which is an opauqe handle to the recorded commands.
device.queue.submit([commandBuffer]); // Submit the GPUCommandBuffer to the GPU, the .submit() method takes in an array of commandBuffers
// Usually are merged above because the commandBuffer can not be used again.


