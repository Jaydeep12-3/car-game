// Wait for the window to load so Three.js is available
window.onload = init;

let scene, camera, renderer;
let carGroup, wheels = [];
let keys = { w: false, a: false, s: false, d: false, space: false };
let speed = 0;
let angle = 0;
let steeringAngle = 0;

// Physics constants
const MAX_SPEED = 1.5;
const ACCELERATION = 0.02;
const BRAKING = 0.05;
const FRICTION = 0.01;
const TURN_SPEED = 0.04;

// DOM Elements
const speedEl = document.getElementById('speed');
const loadingScreen = document.getElementById('loading');

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 50, 300); // Fog to hide the world edge

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; // High res shadows
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;
    scene.add(dirLight);

    // 5. Build the World
    buildWorld();

    // 6. Build the Car
    buildCar();

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('keyup', onKeyUp, false);

    // Hide Loading Screen
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 500);

    // Start Loop
    animate();
}

function buildWorld() {
    // Massive Ground Plane
    const groundGeo = new THREE.PlaneGeometry(2000, 2000, 50, 50);
    
    // Create a basic grid texture programmatically
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4CAF50'; // Grass green
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#388E3C'; // Darker green grid lines
    ctx.lineWidth = 4;
    for(let i=0; i<=512; i+=64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(100, 100); // Repeat across the massive plane

    const groundMat = new THREE.MeshLambertMaterial({ map: texture });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2; // Lay flat
    ground.receiveShadow = true;
    scene.add(ground);

    // Procedurally generate trees (The "World")
    const treeGeoTrunk = new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
    const treeMatTrunk = new THREE.MeshLambertMaterial({ color: 0x5D4037 }); // Brown
    const treeGeoLeaves = new THREE.ConeGeometry(2.5, 6, 8);
    const treeMatLeaves = new THREE.MeshLambertMaterial({ color: 0x2E7D32 }); // Dark Green

    for (let i = 0; i < 400; i++) {
        // Random position, avoiding the exact center where the car spawns
        let x = (Math.random() - 0.5) * 1000;
        let z = (Math.random() - 0.5) * 1000;
        
        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue; // Keep spawn clear

        const tree = new THREE.Group();
        
        const trunk = new THREE.Mesh(treeGeoTrunk, treeMatTrunk);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        
        const leaves = new THREE.Mesh(treeGeoLeaves, treeMatLeaves);
        leaves.position.y = 6;
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        
        tree.add(trunk);
        tree.add(leaves);
        
        tree.position.set(x, 0, z);
        
        // Random scale and rotation for variety
        let scale = 0.8 + Math.random() * 0.7;
        tree.scale.set(scale, scale, scale);
        tree.rotation.y = Math.random() * Math.PI;
        
        scene.add(tree);
    }
}

function buildCar() {
    carGroup = new THREE.Group();

    // Car Body Material (Glossy Paint)
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0xff3366, 
        roughness: 0.2, 
        metalness: 0.3 
    });
    
    // Windows Material
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.1,
        metalness: 0.8
    });

    // Main Chassis
    const chassisGeo = new THREE.BoxGeometry(2, 0.6, 4.5);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.6;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    carGroup.add(chassis);

    // Cabin (Roof)
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.5, 2.2);
    const cabin = new THREE.Mesh(cabinGeo, windowMat);
    cabin.position.y = 1.15;
    cabin.position.z = -0.2;
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    
    const wheelPositions = [
        [-1.1, 0.4, 1.5],  // Front Left
        [1.1, 0.4, 1.5],   // Front Right
        [-1.1, 0.4, -1.5], // Back Left
        [1.1, 0.4, -1.5]   // Back Right
    ];

    wheelPositions.forEach((pos, index) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos[0], pos[1], pos[2]);
        wheel.castShadow = true;
        carGroup.add(wheel);
        wheels.push(wheel); // Store for animation (rotation)
    });

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headlightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
    const hlLeft = new THREE.Mesh(headlightGeo, lightMat);
    hlLeft.position.set(-0.7, 0.6, 2.26);
    const hlRight = new THREE.Mesh(headlightGeo, lightMat);
    hlRight.position.set(0.7, 0.6, 2.26);
    carGroup.add(hlLeft);
    carGroup.add(hlRight);

    scene.add(carGroup);
}

// --- Controls & Input ---
function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': keys.w = true; break;
        case 'ArrowLeft':
        case 'KeyA': keys.a = true; break;
        case 'ArrowDown':
        case 'KeyS': keys.s = true; break;
        case 'ArrowRight':
        case 'KeyD': keys.d = true; break;
        case 'Space': keys.space = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': keys.w = false; break;
        case 'ArrowLeft':
        case 'KeyA': keys.a = false; break;
        case 'ArrowDown':
        case 'KeyS': keys.s = false; break;
        case 'ArrowRight':
        case 'KeyD': keys.d = false; break;
        case 'Space': keys.space = false; break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Physics & Game Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Acceleration & Braking
    if (keys.w) {
        speed += ACCELERATION;
    } else if (keys.s) {
        speed -= BRAKING;
    } else {
        // Friction
        if (speed > 0) {
            speed -= FRICTION;
            if (speed < 0) speed = 0;
        } else if (speed < 0) {
            speed += FRICTION;
            if (speed > 0) speed = 0;
        }
    }

    // Handbrake
    if (keys.space) {
        if (speed > 0) speed -= BRAKING * 2;
        if (speed < 0) speed += BRAKING * 2;
        if (Math.abs(speed) < 0.1) speed = 0;
    }

    // Cap Speed
    speed = Math.max(-MAX_SPEED / 2, Math.min(speed, MAX_SPEED));

    // Steering
    // You can only steer if you are moving
    if (Math.abs(speed) > 0.05) {
        let steerFactor = (speed > 0) ? 1 : -1; // Reverse steering direction when going backwards
        
        if (keys.a) {
            steeringAngle += TURN_SPEED * steerFactor;
        }
        if (keys.d) {
            steeringAngle -= TURN_SPEED * steerFactor;
        }
    }

    // Apply Steering Friction (Auto-center)
    if (!keys.a && !keys.d) {
        steeringAngle *= 0.8;
    }
    steeringAngle = Math.max(-0.6, Math.min(steeringAngle, 0.6)); // Max steer angle

    // Apply rotation
    carGroup.rotation.y += steeringAngle * Math.abs(speed) * 0.1;

    // Apply movement based on current rotation
    carGroup.position.x += Math.sin(carGroup.rotation.y) * speed;
    carGroup.position.z += Math.cos(carGroup.rotation.y) * speed;

    // Animate wheels
    wheels.forEach((wheel, index) => {
        // Rotate wheels based on speed
        wheel.rotation.x += speed * 0.5;
        
        // Steer front wheels
        if (index < 2) { // Front wheels
            wheel.rotation.y = steeringAngle;
        }
    });

    // Update HUD
    // Math.abs(speed) mapped to 0-200 km/h approx
    let displaySpeed = Math.round(Math.abs(speed) / MAX_SPEED * 200);
    speedEl.innerText = displaySpeed;

    // Camera Follow Logic (Smooth lerp)
    // We want the camera behind and slightly above the car
    const relativeCameraOffset = new THREE.Vector3(0, 4, -12);
    // Apply the car's current rotation to the offset
    const cameraOffset = relativeCameraOffset.applyMatrix4(carGroup.matrixWorld);
    
    // Smoothly interpolate camera position
    camera.position.lerp(cameraOffset, 0.1);
    
    // Look at slightly ahead of the car
    const lookAtTarget = new THREE.Vector3(0, 1, 5).applyMatrix4(carGroup.matrixWorld);
    
    // Smoothly interpolate look target (optional, but makes it smoother)
    // For simplicity, directly look at target
    camera.lookAt(lookAtTarget);

    renderer.render(scene, camera);
}
