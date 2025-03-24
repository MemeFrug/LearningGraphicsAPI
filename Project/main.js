// Written by Max K
console.log("main.js loaded");

// Check if WebGPU Exists in Current Scope

if (!navigator.gpu) {
    return new Error("WebGPU Does not exist in the browser.");
};

// Get WebGPU adaptor
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    return new Error("No appropriate GPUAdapter found.")
};

// Get GPUDevice through adapter
const device = await adapter.requestDevice(); // More options can be passed here, for req. higher limits for example.
