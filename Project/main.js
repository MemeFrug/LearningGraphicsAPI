import { Engine } from "./Engine.js";
import { shaderCode } from "./shaders.js";

// Written by Max K
console.log("main.js loaded");

const Gravity = 9.8;
const projectEngine = new Engine(); // Instantiates on Load

let pipeline = null; // Pipeline for the player
let playerPositionUniformObject = null; // Uniform buffer for the player position

class Platform {
    constructor(x, y, width, height) {
        this.position = { x: x, y: y };
        this.width = width;
        this.height = height;
        this.vertices = {
            data: new Float32Array([
                //X,    Y,
                x - width / 2, y - height / 2, // Triangle 1 (Blue)
                x + width / 2, y - height / 2,
                x + width / 2, y + height / 2,

                x - width / 2, y - height / 2, // Triangle 2 (Red)
                x + width / 2, y + height / 2,
                x - width / 2, y + height / 2,
            ]),
            layout: {
                arrayStride: 8,
                attributes: [{
                    format: "float32x2",
                    offset: 0,
                    shaderLocation: 0, // Position, see vertex shader
                }],
            }
        };
    };
}

const player = {
    position: new Float32Array([0.0, 0.0]), // Player position
    velocity: new Float32Array([0.0, 0.0]), // Player velocity
    vertices: {
        data: new Float32Array([
            //X,    Y,
            -0.5, -0.5, // Triangle 1
             0.5, -0.5,
             0.5,  0.5,

            -0.5, -0.5, // Triangle 2
             0.5,  0.5,
            -0.5,  0.5,
        ]),
        layout: {
            arrayStride: 8,
            attributes: [{
              format: "float32x2",
              offset: 0,
              shaderLocation: 0, // Position, see vertex shader
            }],
        }
    },
}

const init = async () => {
    await projectEngine.Instantiate();
    projectEngine.ApplyCanvas(document.getElementById("canvas"), 1920, 1080);
    projectEngine.createVertexBuffer(player.vertices.data, player.vertices.layout, "PlayerVertices");
    const shaderModule = projectEngine.getShaderModule(shaderCode);
    pipeline = projectEngine.createPipeline(shaderModule, shaderModule, player.vertices.layout); // Create the pipeline

    // Player
    playerPositionUniformObject = projectEngine.createUniformBuffer(player.position, "PlayerUniforms", player.vertices.layout);
    projectEngine.createBindGroup(playerPositionUniformObject.buffer, pipeline, 0, 0); // Bind group for player position

    update();
};

const update = () => {
    player.velocity[1] += (player.velocity[1] - Gravity) * 0.00001; // Apply gravity to player position
    player.position[1] += player.velocity[1]; // Update player position
    playerPositionUniformObject.updateBuffer(player.position); // Update the player position uniform buffer
    projectEngine.RenderPass(pipeline);
    requestAnimationFrame(update);
};

window.player = player; // Expose player to the console for debugging
window.projectEngine = projectEngine; // Expose projectEngine to the console for debugging
window.onload = init;