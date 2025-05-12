export {Engine}
//Written By Max K
class Engine {
    constructor(canvas = null, InstantiateOnLoad = true) {
        if (InstantiateOnLoad) {
            window.onload = this.Instantiate()
        }
        this.canvas = canvas;
        this.context = null;

        // I need to get an adaptor 
        this.adapter = null; // Physical properties of a given GPU, such as its name, extensions, and device limits.
        //device handle
        this.device = null; // How you access the core of WebGPU API, and will alow you to create the data structures you'll need
        // Declare a queue handle
        this.queue = null; // A Queue allows work to be sent asynchronously to the GPU.
        // Declare attachment handles
        this.depthTexture = null;
        this.depthTextureView = null;

        // Declare canvas context image handles
        this.colorTexture = null;
        this.colorTextureView = null;

        // Declare buffer handles
        this.vertexBuffer = null;
        this.colorBuffer = null;
        this.indexBuffer = null;

        // Declare Command Handles
        this.commandEncoder = null;

        // Render Pipeline
        this.pipeline = null;
        this.onload = () => {};
        //Bind Group
        this.uniformBindGroup = null;
        this.uniformBindGroupLayout = null;
    }

    createBuffer = (arr, usage) => { // Returns Buffer
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

    ApplyCanvas = async (canvas, width = 1920, height = 1080) => {
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
        console.log("Engine Loading");

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
            await this.ApplyCanvas(this.canvas);
        }

        // Create Depth Backing GPUTextureDescriptor
        const depthTextureDesc = {
            size: [this.canvas.width, this.canvas.height, 1],
            dimension: "2d",
            format: "depth24plus-stencil8", // Format
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        }

        this.depthTexture = this.device.createTexture(depthTextureDesc);
        this.depthTextureView = this.depthTexture.createView();

        console.log("Engine Loaded");
        this.onload();

    }
    
    RenderPass = async () => {
        // Acquire next image from context
        this.colorTexture = this.context.getCurrentTexture();
        this.colorTextureView = this.colorTexture.createView();
        
        // Since the commands we want to sent to the GPU are related to rendering,
        // (Clearing Canvas) we want to use this encoder to begin a render pass
        // Call the render pass, which defines the textures that reveive the output of any drawing commands.
        const renderPass = this.commandEncoder.beginRenderPass({// Returns a texture with a pixel width and height matching the canvas's attributes and the same format as above
            colorAttachments: [{
                view: this.colorTextureView/* Render Passes require a GPUTextureView instead of GPUTexture *//* Since no Arguments, Indicates want render pass to use entire texture */,
                // We have to specify what we want the render pas to do with the texture when it starts and ends
                loadOp: "clear", //Indicates want texture to be cleared on start
                clearValue: [0,0,0,1], // r, g, b, a
                storeOp: "store" // Indicates that once the render pass completes, the results of the drawing during the render pass, gets saved into the texture
            }],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                stencilClearValue: 0,
                stencilLoadOp: "clear",
                stencilStoreOp: "store",
            },
        }) 

        renderPass.setPipeline(this.pipeline); // Shaders that are used ect.
        renderPass.setVertexBuffer(0, this.vertexBuffer); // 0th element in the vertex.buffers definition
        renderPass.setViewport(0, 0, this.canvas.width, this.canvas.height, 0, 1); // Don't know what this one does, but is inferred to change viewport position and size
        renderPass.setScissorRect(0, 0, this.canvas.width, this.canvas.height); // Don't know what these do, could do more research

        

        renderPass.draw(vertices.length/2, GRID_SIZE * GRID_SIZE); // 6 vertices. The second argument is how many instances
        renderPass.end(); // Ends the render pass
        // Note that making these calls to the methods do not instruct the GPU to enact, their just recording commands

        const commandBuffer = this.commandEncoder.finish() // Create a GPUCommandBuffer which is an opauqe handle to the recorded commands.
        this.device.queue.submit([commandBuffer]); // Submit the GPUCommandBuffer to the GPU, the .submit() method takes in an array of commandBuffers
        // Usually are merged above because the commandBuffer can not be used again.
    }

}