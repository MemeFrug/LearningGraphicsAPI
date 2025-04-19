console.log("main.js loaded");

// First I need to access WebGPU's API
const entry = navigator.gpu;
if (!entry) {
    throw new Error("WebGPU does not exist on this browser.");
}

// I need to get an adaptor 
let adaptor = null;