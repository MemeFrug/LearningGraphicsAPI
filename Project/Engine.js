export {Engine, EngineElement};

//Written By Max K
class EngineElement {
    constructor(pipeline, device) {
        this.pipeline = pipeline;
        this.device = device;
        this.uniformBuffers = [];

        this.vertexBuffer = null;

        this.bindGroups = [];
    }

    getBoundingBox = (vertices, position) => {
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (let i = 0; i < vertices.length; i += 2) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const worldX = position[0] + x;
            const worldY = position[1] + y;
            minX = Math.min(minX, worldX);
            maxX = Math.max(maxX, worldX);
            minY = Math.min(minY, worldY);
            maxY = Math.max(maxY, worldY);
        }


        // Return the bounding box of the vertices
        return { minX, minY, maxX, maxY, center: {x: (minX + maxX) / 2, y: (minY + maxY) / 2}};
    }

    createVertexBuffer = (vertices, bufferLayout = null, label = "CreatedBuffer", instances=1) => {
        console.log("Creating Vertex Buffer", label);
        // Create a vertex buffer to hold the vertices
        const buffer = this.device.createBuffer({
            label: label,
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })

        const vertexBuffer = {buffer: buffer, layout: bufferLayout, instances: instances, updateBuffer: (updatedVertices) => {this.device.queue.writeBuffer(buffer, /*Buffer Offset*/0, updatedVertices);}}; // Create a vertex buffer to hold the vertices
        vertexBuffer.updateBuffer(vertices); // Write the vertices to the buffer
        this.vertexBuffer = vertexBuffer; // Add the buffer to the list of vertex buffers
    }

    createUniformBuffer = (data, label = "UniformBuffer"+this.vertexBuffers.length) => {
        console.log("Creating UniformBuffer", label);
        // Create a uniform buffer to hold the uniforms
        const buffer = this.device.createBuffer({
            label: label,
            size: data.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        
        const uniformBuffer = {buffer: buffer, updateBuffer: (updateValue) => {this.device.queue.writeBuffer(buffer, /*Buffer Offset*/0, updateValue);}}; // Create a uniform buffer to hold the uniforms
        this.uniformBuffers.push(uniformBuffer); // Add the buffer to the list of uniform buffers
        this.device.queue.writeBuffer(uniformBuffer.buffer, /*Buffer Offset*/0, data); // Write the uniforms to the buffer
        return uniformBuffer; // Return the uniform buffer
    }

    createBindGroup = (shaderGroup, entries = [/* Format shown below */]) => {
        console.log("Creating Bind Group");
        // Create a bind group to hold the uniforms and the bind group layout
        const GPUbindGroup = this.device.createBindGroup({
            label: "BindGroup",
            layout: this.pipeline.getBindGroupLayout(shaderGroup), // The layout of the bind group, this is the first layout in the pipeline
            entries: entries,
            // [ 
                // {
                //     binding: shaderBind, // The binding of the uniform buffer in the shader
                //     resource: { buffer: buffer }, // The uniform buffer to be used in the bind group
                // }
            // ],
        });
        return {bindGroup: GPUbindGroup, shaderBind: shaderGroup}; // Return the bind group
    }
}

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

        this.desiredCanvasSize = {
            width: null,
            height: null,
        };

        this.cameraElement = null;

        this.elements = [];
    }

    checkRectangularCollision = (rect1, rect2) => {
        const a = rect1.getBoundingBox(rect1.vertices.data, rect1.position);
        const b = rect2.getBoundingBox(rect2.vertices.data, rect2.position);
        // Early exit if no collision
        if (a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY) {
            return null;
        }

        // Calculate overlaps for all four sides
        const overlaps = {
            left: a.maxX - b.minX,   // Overlap on rectB's left side
            right: b.maxX - a.minX,  // Overlap on rectB's right side
            bottom: a.maxY - b.minY, // Overlap on rectB's bottom side (Y↑: rectA is below rectB)
            top: b.maxY - a.minY     // Overlap on rectB's top side (Y↑: rectA is above rectB)
        };

        // Find the smallest positive overlap (ignore negative values)
        let minOverlap = Infinity;
        let collisionSide = null;
        for (const [side, value] of Object.entries(overlaps)) {
            if (value > 0 && value < minOverlap) {
            minOverlap = value;
            collisionSide = side;
            }
        }

        if (!collisionSide) return null;

        // Determine axis and direction based on collision side
        let axis, direction;
        switch (collisionSide) {
            case 'left':
            axis = 'x';
            direction = -1;
            break;
            case 'right':
            axis = 'x';
            direction = 1; 
            break;
            case 'bottom':
            axis = 'y';
            direction = -1;
            break;
            case 'top':
            axis = 'y';
            direction = 1; 
            break;
        }

        return { axis, overlap: minOverlap, direction };
    }

    resolveCollision = (rect1, rect2, mtv) => {
        const move = mtv.direction * mtv.overlap; //Move each rect half the distance of the overlap
        
        const rect1Static = rect1.static;
        const rect2Static = rect2.static;
        if (rect1Static && rect2Static) return; // Both are static, no movement
        const axis = mtv.axis === 'x' ? 0 : 1;
        if (rect1Static) {
            rect2.position[axis] += move; // Move the dynamic rect
        } else if (rect2Static) {
            // console.log(rect1.position[axis]);
            rect1.position[axis] += move; // Move the dynamic rect
        } else {
            rect1.position[axis] -= move / 2; // Move both rectangles
            rect2.position[axis] += move / 2;
        }
    }

    newElement = (newElement= new Object(this)) => {
        this.elements.push(newElement);
        return newElement;
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
        this.canvas = canvas;
        this.canvas.width = width;
        this.canvas.height = height;

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
            this.ApplyCanvas(this.canvas);
        }

        console.log("Engine Loaded");
    }

    RenderPass = async (pipeline, camera) => {
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

        //Need to create an object list, where each object has a bind and vertex buffers.
        this.elements.forEach(element => {
            if (element.vertexBuffer == null) {return;} // If the element has no vertex buffer, skip it
            
            this.renderPass.setBindGroup(0, camera.bindGroups[0].bindGroup); // Set the bind group to be used in the render pass

            element.bindGroups.forEach(bind => {
                this.renderPass.setBindGroup(/* Group */bind.shaderBind, bind.bindGroup); // Set the bind group to be used in the render pass
            });

            this.renderPass.setVertexBuffer(0, element.vertexBuffer.buffer); // Set the vertex buffer to be used in the render pass
            
            this.renderPass.draw(element.vertexBuffer.buffer.size/element.vertexBuffer.layout.arrayStride, element.vertexBuffer.instances); // Draw the vertices in the vertex buffer

        });

        this.renderPass.end()

        this.device.queue.submit([this.commandEncoder.finish()]); // Submit the command buffer to the GPU queue
    
        
    }

}