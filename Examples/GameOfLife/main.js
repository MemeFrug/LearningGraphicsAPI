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
const canvasFormat = navigator.gpu.getPrefferedCanvasFormat();
context.configure({
    device: device,
    format: canvasFormat
});

