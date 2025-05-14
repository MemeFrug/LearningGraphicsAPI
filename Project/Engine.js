export {Engine}
//Written By Max K
class Engine {
    constructor(canvas = null) {
        this.canvas = canvas;
        this.context = null;
        this.canvasFormat = null;
        this.commandEncoder = null;
        this.device = null;

        this.shaderCodeModule = null;

        this.renderPass = null;
        this.viewTexture = null;

        this.bindGroups = [
            
        ];

        this.vertexBuffers = [

        ];

        this.desiredCanvasSize = {
            width: null,
            height: null,
        };
    }

    createVertexBuffer = (vertices, bufferLayout = null, label = "Buffer"+this.vertexBuffers.length, instances=1) => {
        console.log("Creating Vertex Buffer");
        // Create a vertex buffer to hold the vertices
        const buffer = this.device.createBuffer({
            label: label,
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
        this.device.queue.writeBuffer(buffer, /*Buffer Offset*/0, vertices); // Write the vertices to the buffer
        this.vertexBuffers.push({buffer: buffer, layout: bufferLayout, instances: instances}); // Add the buffer to the list of vertex buffers
    }

    createUniformBuffer = (data, label = "UniformBuffer"+this.vertexBuffers.length) => {
        console.log("Creating Uniform Buffer");
        // Create a uniform buffer to hold the uniforms
        const buffer = this.device.createBuffer({
            label: label,
            size: data.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        this.device.queue.writeBuffer(buffer, /*Buffer Offset*/0, data); // Write the uniforms to the buffer
        return {buffer:buffer, updateBuffer: (updateValue) => {this.device.queue.writeBuffer(buffer, /*Buffer Offset*/0, updateValue);}};
    }

    createBindGroup = (uniformBuffer, pipeline, shaderGroup = 0, shaderBind) => {
        console.log("Creating Bind Group");
        // Create a bind group to hold the uniforms and the bind group layout
        const GPUbindGroup = this.device.createBindGroup({
            label: "BindGroup",
            layout: pipeline.getBindGroupLayout(shaderGroup), // The layout of the bind group, this is the first layout in the pipeline
            entries: [{
                binding: shaderBind, // The binding of the uniform buffer in the shader
                resource: { buffer: uniformBuffer }, // The uniform buffer to be used in the bind group
            }],
        });
        this.bindGroups.push({bindGroup: GPUbindGroup, shaderBind: shaderBind}); // Set the bind group to be used in the render pass
    }

    createPipeline = (vertexModule, fragmentModule, vertexBufferLayouts) => {
        console.log("Creating Pipeline");
        // Create a pipeline to hold the shaders and the vertex buffers
        const pipeline = this.device.createRenderPipeline({
            label: "Pipeline",
            layout: "auto", // The layout of the pipeline, auto will create a new layout for the pipeline
            // The layout of the pipeline is used to bind the vertex buffers and the shaders to the pipeline
            vertex: {
                module: vertexModule,
                entryPoint: "vertMain",
                buffers: vertexBufferLayouts, // The layout of the vertex buffer
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "fragMain",
                targets: [{
                    format: this.canvasFormat, // The format of the canvas
                }],
            },
            primitive: { // RESEARCH THIS
                topology: "triangle-list", // The topology of the vertices
            },
        });

        return pipeline; // Return the pipeline
    }

    getShaderModule = (shaderCode) => {
        console.log("Setting Shaders,", {code: shaderCode});
        // Set the shaders to be used in the engine
        const shaderCodeModule = this.device.createShaderModule({ label: "FragAndVertShader", code: shaderCode });
        return shaderCodeModule; // Return the shader module
    }


    ApplyCanvas = (canvas, width = 1920, height = 1080) => {
        console.log("Applying Canvas");
        //Initialise the canvas
        this.desiredCanvasSize.width = width;
        this.desiredCanvasSize.height = height;
        this.canvas = canvas;

        //Get the canvas
        this.context = canvas.getContext("webgpu");

        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device, // What device im going to use the context with
            format: this.canvasFormat // The texture format the context should use
        });

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target != this.canvas) {continue;}
              const width = entry.devicePixelContentBoxSize?.[0].inlineSize ||
                            entry.contentBoxSize[0].inlineSize * devicePixelRatio;
              const height = entry.devicePixelContentBoxSize?.[0].blockSize ||
                             entry.contentBoxSize[0].blockSize * devicePixelRatio;
              this.desiredCanvasSize.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D));
              this.desiredCanvasSize.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D));
            }
          });
          try { // To ensure that the observer works in all browsers
            observer.observe(this.canvas, { box: 'device-pixel-content-box' });
          } catch {
            observer.observe(this.canvas, { box: 'content-box' });
          }
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
            this.ApplyCanvas(this.canvas);
        }

        console.log("Engine Loaded");
    }
    
    RenderPass = async (pipeline) => {
        //Update Canvas
        if (this.canvas.width !== this.desiredCanvasSize.width || canvas.height !== this.desiredCanvasSize.height) {
            this.canvas.width = this.desiredCanvasSize.width;
            this.canvas.height = this.desiredCanvasSize.height;
        }
        this.viewTexture = this.context.getCurrentTexture()

        this.commandEncoder = this.device.createCommandEncoder();
        
        // Create a render pass to render to the canvas
        this.renderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.viewTexture.createView(), // The texture we are going to render to
                loadOp: "clear", // Clear Color
                clearValue: [1, 1, 1, 1 ], // New line
                storeOp: "store" // Store the result of the render pass in the texture
            }]
        });

        this.renderPass.setPipeline(pipeline); // Set the pipeline to be used in the render pass

        this.renderPass.setViewport(0, 0, this.canvas.width, this.canvas.height, 0, 1); // Set the viewport to be used in the render pass
        this.renderPass.setScissorRect(0, 0, this.canvas.width, this.canvas.height); // Set the scissor rect to be used in the render pass

        this.bindGroups.forEach(bind => {
            this.renderPass.setBindGroup(/* Group */bind.shaderBind, bind.bindGroup); // Set the bind group to be used in the render pass
        });

        this.vertexBuffers.forEach(vertexBuffer => {
            this.renderPass.setVertexBuffer(vertexBuffer.layout.attributes[0].shaderLocation, vertexBuffer.buffer); // Set the vertex buffer to be used in the render pass
            this.renderPass.draw(vertexBuffer.buffer.size/vertexBuffer.layout.arrayStride, vertexBuffer.instances); // Draw the vertices in the vertex buffer
        });

        this.renderPass.end()


        this.device.queue.submit([this.commandEncoder.finish()]); // Submit the command buffer to the GPU queue
    
        
    }

}