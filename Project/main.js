import { Engine } from "./Engine.js";
import { shaderCode } from "./shaders.js";

// Written by Max K
console.log("main.js loaded");

const Gravity = 9.8;
const projectEngine = new Engine(); // Instantiates on Load

let pipeline = null; // Pipeline for the player
let playerPositionUniformObject = null; // Uniform buffer for the player position

const collidableObjects = [];

class Platform {
    constructor(x, y, width, height, collidable) {
        this.position = new Float32Array([x, y]);
        this.width = width;
        this.height = height;
        this.vertices = {
            data: new Float32Array([
                //X,    Y,
                -width, -height, // Triangle 1 (Blue)
                width, -height,
                width, height,

                -width, -height, // Triangle 2 (Red)
                width, height,
                -width, height,
            ]),
            // layout: {
            //     arrayStride: 8,
            //     attributes: [{
            //         format: "float32x2",
            //         offset: 0,
            //         shaderLocation: 0, // Position, see vertex shader
            //     }],
            // }
        };
        
        this.uniformObject = null;

        this.collidable = collidable;
    }

    init = () => {
        if (this.collidable) {
            collidableObjects.push(this);
        }
    }
}

const player = {
    speed: 0.01,// Player speed
    position: new Float32Array([0.0, 0.0]), // Player position
    velocity: new Float32Array([0.0, 0.0]), // Player velocity
    vertices: {
        data: new Float32Array([
            //X,    Y,
            -0.3, -0.5, // Triangle 1
             0.3, -0.5,
             0.3,  0.5,

            -0.3, -0.5, // Triangle 2
             0.3,  0.5,
            -0.3,  0.5,
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
    keyboardEvents: {
        jump: false,
        left: false,
        right: false,
    },
    update: (dt) => {
        if (player.keyboardEvents.jump) {
            player.jump()            
        };
        if (player.keyboardEvents.left) {
            player.velocity[0] -= player.speed * dt;
        };
        if (player.keyboardEvents.right) {
            player.velocity[0] += player.speed * dt;
        };
    },
    jump: () => {
        return;
    }
}

const init = async () => {
    await projectEngine.Instantiate();
    projectEngine.ApplyCanvas(document.getElementById("canvas"), 1920, 1080);
    projectEngine.createVertexBuffer(player.vertices.data, player.vertices.layout, "PlayerVertices");
    const shaderModule = projectEngine.getShaderModule(shaderCode);

    //Platform
    let platform = new Platform(-1,-1,10,1,true)
    projectEngine.createVertexBuffer(platform.vertices.data, player.vertices.layout, "PlatformVertices")
    // platform.uniformObject = projectEngine.createUniformBuffer(platform.position, "Platform1Uniform")
    // projectEngine.createBindGroup(platform.uniformObject.buffer, pipeline, 0, 0); // Bind group for player position
    // platform.init()

    pipeline = projectEngine.createPipeline(shaderModule, shaderModule, [player.vertices.layout]); // Create the pipeline

    // Player
    playerPositionUniformObject = projectEngine.createUniformBuffer(player.position, "PlayerUniforms");
    projectEngine.createBindGroup(playerPositionUniformObject.buffer, pipeline, 0, 0); // Bind group for player position

    requestAnimationFrame(update);
};

let lastTime = undefined
const update = (timeElapsed) => {
    const dt = timeElapsed - lastTime
    lastTime = timeElapsed
    player.update(dt);

    // player.velocity[1] += (player.velocity[1] - Gravity) * 0.00001; // Apply gravity to player position
    player.position[1] += player.velocity[1]; // Update player position
    player.velocity[0] = player.velocity[0] * 0.1; // Bring it towrads 0
    player.position[0] += player.velocity[0];

    //Update platform positions
    // collidableObjects.forEach(platform => {
    //     platform.uniformObject.updateBuffer(platform.position); // Update platform position
    // });

    //Update player position
    playerPositionUniformObject.updateBuffer(player.position); // Update the player position uniform buffer
    projectEngine.RenderPass(pipeline);
    requestAnimationFrame(update);
};

//Listen for keyboard events
window.addEventListener("keydown", (event) => {
    switch (event.code) {
        case "KeyW":
            player.keyboardEvents.jump = true;
            break;
        case "Space":
            player.keyboardEvents.jump = true;
            break;
        case "KeyA":
            player.keyboardEvents.left = true;
            break;
        case "KeyD":
            player.keyboardEvents.right = true;
            break;

        default:
            break;
    };
});
window.addEventListener("keyup", (event) => {
    switch (event.code) {
        case "KeyW":
            player.keyboardEvents.jump = false;
            break;
        case "Space":
            player.keyboardEvents.jump = false;
            break;
        case "KeyA":
            player.keyboardEvents.left = false;
            break;
        case "KeyD":
            player.keyboardEvents.right = false;
            break;

        default:
            break;
    };
});

window.player = player; // Expose player to the console for debugging
window.projectEngine = projectEngine; // Expose projectEngine to the console for debugging
window.onload = init;