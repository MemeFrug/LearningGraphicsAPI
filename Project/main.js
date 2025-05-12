// Written by Max K
console.log("main.js loaded");

class Engine {
    constructor(canvas = null, InstantiateOnLoad = true) {
        if (InstantiateOnLoad) {
            window.onload = this.Instantiate()
        }
        this.canvas = canvas;
        this.context = null;
        this.devie = null;
    }

    ApplyCanvas = (canvas, width = 1920, height = 1080) => {
        console.log("Applying Canvas");
        //Initialise the canvas
        this.canvas = canvas;
        canvas.width=1920;
        canvas.height=1080;

        //Get the canvas
        this.context = canvas.getContext("webgpu");

        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device, // What device im going to use the context with
            format: this.canvasFormat // The texture format the context should use
        });
    }

     Instantiate = async () => {
        console.log("EngineLoaded");

        // Check if WebGPU Exists in Current Scope
        if (!navigator.gpu) {
            return new Error("WebGPU Does not exist in the browser.");
        };
        
        // Get WebGPU adaptor
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            return new Error("No appropriate GPUAdapter found.")
        };

        // Lets now get the GPUDevice through the adaptor
        this.device = await adapter.requestDevice(); // More options can be passed here, for req. higher limits for example.

        if (this.canvas) {
            this.ApplyCanvas(canvas);
        }
    }

}

const projectEngine = new Engine(document.getElementById("canvas"));