// Wait for the window to load so Three.js is available
window.onload = init;

let scene, camera, renderer;
let carGroup, wheels = [];
let keys = { w: false, a: false, s: false, d: false, space: false };

let speed = 0;
let angle = 0;
let steeringAngle = 0;

// Physics constants
let maxSpeedLimit = 1.5;
const ACCELERATION = 0.02;
const BRAKING = 0.05;
const FRICTION = 0.01;
const TURN_SPEED = 0.04;

// Slider logic
const maxSpeedSlider = document.getElementById('max-speed-slider');
const speedDisplay = document.getElementById('speed-display');
if(maxSpeedSlider) {
    maxSpeedSlider.addEventListener('input', (e) => {
        maxSpeedLimit = parseFloat(e.target.value);
        speedDisplay.innerText = maxSpeedLimit.toFixed(1);
    });
}

// DOM Elements
const speedEl = document.getElementById('speed');
const loadingScreen = document.getElementById('loading');

function init() {

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 300);

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document
        .getElementById('canvas-container')
        .appendChild(renderer.domElement);

    // 4. Lighting

    const ambientLight = new THREE.AmbientLight(
        0xffffff,
        0.6
    );

    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(
        0xffffff,
        0.8
    );

    dirLight.position.set(100, 200, 50);

    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;

    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;

    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;

    scene.add(dirLight);

    // Build World & Car
    buildWorld();
    buildCar();

    // Events
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('keyup', onKeyUp, false);

    // Mobile Controls
    setupMobileControls();

    // Hide Loading
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 500);

    // Start Game
    animate();
}

// Infinite World Globals
let chunks = [];
const CHUNK_SIZE = 400;

const sharedMaterials = {
    ground: new THREE.MeshLambertMaterial({ color: 0x4CAF50 }),
    road: new THREE.MeshLambertMaterial({ color: 0x333333 }),
    line: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    treeTrunk: new THREE.MeshLambertMaterial({ color: 0x5D4037 }),
    treeLeaf: new THREE.MeshLambertMaterial({ color: 0x2E7D32 }),
    buildings: [
        new THREE.MeshLambertMaterial({ color: 0xFFFFFF }),
        new THREE.MeshLambertMaterial({ color: 0xDDDDDD }),
        new THREE.MeshLambertMaterial({ color: 0xAAAAAA }),
        new THREE.MeshLambertMaterial({ color: 0xFFE0B2 }),
        new THREE.MeshLambertMaterial({ color: 0xB0BEC5 }),
        new THREE.MeshLambertMaterial({ color: 0x81D4FA })
    ]
};

const sharedGeometries = {
    ground: new THREE.PlaneGeometry(2000, CHUNK_SIZE),
    road: new THREE.PlaneGeometry(16, CHUNK_SIZE),
    line: new THREE.PlaneGeometry(0.5, 8),
    treeTrunk: new THREE.CylinderGeometry(0.5, 0.5, 3, 6),
    treeLeaf: new THREE.ConeGeometry(2.5, 6, 6)
};

function buildWorld() {
    // Initial chunks
    for(let i = -1; i <= 3; i++) {
        generateChunk(i * CHUNK_SIZE);
    }
}

function generateChunk(zOffset) {
    const chunk = new THREE.Group();
    chunk.userData.zOffset = zOffset;

    // Ground
    const ground = new THREE.Mesh(sharedGeometries.ground, sharedMaterials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    chunk.add(ground);

    // Road
    const road = new THREE.Mesh(sharedGeometries.road, sharedMaterials.road);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.05;
    road.receiveShadow = true;
    chunk.add(road);

    // Lines
    for(let l = -CHUNK_SIZE/2; l < CHUNK_SIZE/2; l += 20) {
        const lMesh = new THREE.Mesh(sharedGeometries.line, sharedMaterials.line);
        lMesh.rotation.x = -Math.PI / 2;
        lMesh.position.set(0, 0.06, l);
        chunk.add(lMesh);
    }

    // Buildings & Dense Jungle
    for(let i = -CHUNK_SIZE/2; i < CHUNK_SIZE/2; i += 40) {
        if(Math.abs(zOffset + i) < 20) continue; // Don't spawn on start

        // Left side
        if(Math.random() > 0.3) {
            // Building
            let w = 10 + Math.random() * 10;
            let d = 10 + Math.random() * 10;
            let h = 15 + Math.random() * 30;
            const geo = new THREE.BoxGeometry(w, h, d);
            const mat = sharedMaterials.buildings[Math.floor(Math.random() * sharedMaterials.buildings.length)];
            const b = new THREE.Mesh(geo, mat);
            b.position.set(-20 - w/2, h/2, i);
            b.castShadow = true;
            b.receiveShadow = true;
            chunk.add(b);
        }
        // Dense Jungle behind left
        for(let t=0; t<8; t++) {
            createTree(chunk, -30 - Math.random() * 100, i + Math.random()*30 - 15);
        }

        // Right side
        if(Math.random() > 0.3) {
            // Building
            let w = 10 + Math.random() * 10;
            let d = 10 + Math.random() * 10;
            let h = 15 + Math.random() * 30;
            const geo = new THREE.BoxGeometry(w, h, d);
            const mat = sharedMaterials.buildings[Math.floor(Math.random() * sharedMaterials.buildings.length)];
            const b = new THREE.Mesh(geo, mat);
            b.position.set(20 + w/2, h/2, i);
            b.castShadow = true;
            b.receiveShadow = true;
            chunk.add(b);
        }
        // Dense Jungle behind right
        for(let t=0; t<8; t++) {
            createTree(chunk, 30 + Math.random() * 100, i + Math.random()*30 - 15);
        }
    }

    chunk.position.z = zOffset;
    scene.add(chunk);
    chunks.push(chunk);
}

function createTree(chunk, x, z) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(sharedGeometries.treeTrunk, sharedMaterials.treeTrunk);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const leaves = new THREE.Mesh(sharedGeometries.treeLeaf, sharedMaterials.treeLeaf);
    leaves.position.y = 6;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    tree.add(trunk);
    tree.add(leaves);
    tree.position.set(x, 0, z);
    let scale = 0.8 + Math.random() * 0.7;
    tree.scale.set(scale, scale, scale);
    tree.rotation.y = Math.random() * Math.PI;
    chunk.add(tree);
}

function manageInfiniteWorld() {
    let carZ = carGroup.position.z;
    let currentChunkIndex = Math.round(carZ / CHUNK_SIZE);
    
    // We need chunks from current-1 to current+3
    let requiredIndices = [
        currentChunkIndex - 1, 
        currentChunkIndex, 
        currentChunkIndex + 1, 
        currentChunkIndex + 2,
        currentChunkIndex + 3
    ];
    
    let existingIndices = chunks.map(c => Math.round(c.userData.zOffset / CHUNK_SIZE));
    
    // Create new chunks
    for(let ri of requiredIndices) {
        if(!existingIndices.includes(ri)) {
            generateChunk(ri * CHUNK_SIZE);
        }
    }
    
    // Remove old chunks
    for(let i = chunks.length - 1; i >= 0; i--) {
        let chunkIndex = Math.round(chunks[i].userData.zOffset / CHUNK_SIZE);
        if(!requiredIndices.includes(chunkIndex)) {
            let chunkToRemove = chunks[i];
            scene.remove(chunkToRemove);
            
            // Dispose unique geometries (BoxGeometry for buildings)
            chunkToRemove.traverse((child) => {
                if(child.isMesh && child.geometry.type === 'BoxGeometry') {
                    child.geometry.dispose();
                }
            });
            
            chunks.splice(i, 1);
        }
    }
}

function buildCar(){

    carGroup = new THREE.Group();

    // Body Material

    const bodyMat = new THREE.MeshStandardMaterial({
        color:0xff3366,
        roughness:0.2,
        metalness:0.3
    });

    // Window Material

    const windowMat = new THREE.MeshStandardMaterial({
        color:0x111111,
        roughness:0.1,
        metalness:0.8
    });

    // Chassis

    const chassisGeo = new THREE.BoxGeometry(
        2,
        0.6,
        4.5
    );

    const chassis = new THREE.Mesh(
        chassisGeo,
        bodyMat
    );

    chassis.position.y = 0.6;

    chassis.castShadow = true;
    chassis.receiveShadow = true;

    carGroup.add(chassis);

    // Cabin

    const cabinGeo = new THREE.BoxGeometry(
        1.8,
        0.5,
        2.2
    );

    const cabin = new THREE.Mesh(
        cabinGeo,
        windowMat
    );

    cabin.position.y = 1.15;
    cabin.position.z = -0.2;

    cabin.castShadow = true;

    carGroup.add(cabin);

    // Wheels

    const wheelGeo = new THREE.CylinderGeometry(
        0.4,
        0.4,
        0.3,
        16
    );

    const wheelMat = new THREE.MeshLambertMaterial({
        color:0x111111
    });

    const wheelPositions = [
        [-1.1, 0.4, 1.5],
        [1.1, 0.4, 1.5],
        [-1.1, 0.4, -1.5],
        [1.1, 0.4, -1.5]
    ];

    wheelPositions.forEach((pos,index)=>{

        const wheel = new THREE.Mesh(
            wheelGeo,
            wheelMat
        );

        wheel.rotation.z = Math.PI / 2;

        wheel.position.set(
            pos[0],
            pos[1],
            pos[2]
        );

        wheel.castShadow = true;

        carGroup.add(wheel);

        wheels.push(wheel);
    });

    // Headlights

    const lightMat = new THREE.MeshBasicMaterial({
        color:0xffffff
    });

    const headlightGeo = new THREE.BoxGeometry(
        0.4,
        0.2,
        0.1
    );

    const hlLeft = new THREE.Mesh(
        headlightGeo,
        lightMat
    );

    hlLeft.position.set(-0.7,0.6,2.26);

    const hlRight = new THREE.Mesh(
        headlightGeo,
        lightMat
    );

    hlRight.position.set(0.7,0.6,2.26);

    carGroup.add(hlLeft);
    carGroup.add(hlRight);

    scene.add(carGroup);
}

// Keyboard Controls

function onKeyDown(event){

    switch(event.code){

        case 'ArrowUp':
        case 'KeyW':
            keys.w = true;
            break;

        case 'ArrowLeft':
        case 'KeyA':
            keys.a = true;
            break;

        case 'ArrowDown':
        case 'KeyS':
            keys.s = true;
            break;

        case 'ArrowRight':
        case 'KeyD':
            keys.d = true;
            break;

        case 'Space':
            keys.space = true;
            break;
    }
}

function onKeyUp(event){

    switch(event.code){

        case 'ArrowUp':
        case 'KeyW':
            keys.w = false;
            break;

        case 'ArrowLeft':
        case 'KeyA':
            keys.a = false;
            break;

        case 'ArrowDown':
        case 'KeyS':
            keys.s = false;
            break;

        case 'ArrowRight':
        case 'KeyD':
            keys.d = false;
            break;

        case 'Space':
            keys.space = false;
            break;
    }
}

// Mobile Controls

function setupMobileControls() {
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    const accBtn = document.getElementById('acc-btn');
    const brakeBtn = document.getElementById('brake-btn');

    if(!leftBtn || !rightBtn || !accBtn || !brakeBtn) return;

    const bindButton = (btn, key) => {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            keys[key] = true;
            btn.style.transform = 'scale(0.9)';
            btn.style.background = 'rgba(255, 51, 102, 0.8)';
        });
        
        const release = (e) => {
            e.preventDefault();
            keys[key] = false;
            btn.style.transform = '';
            btn.style.background = '';
        };

        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointerout', release);
        btn.addEventListener('pointercancel', release);
    };

    bindButton(accBtn, 'w');
    bindButton(brakeBtn, 's');
    bindButton(leftBtn, 'a');
    bindButton(rightBtn, 'd');

    // Prevent default context menu on right click/long press for buttons
    window.addEventListener('contextmenu', e => {
        if(e.target.closest('#mobile-controls')) e.preventDefault();
    });
}

function onWindowResize(){

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}

// Main Game Loop

function animate(){

    requestAnimationFrame(animate);
    
    // Manage Infinite World
    manageInfiniteWorld();

    // Acceleration

    if(keys.w){

        speed += ACCELERATION;

    }
    else if(keys.s){

        speed -= BRAKING;

    }
    else{

        if(speed > 0){

            speed -= FRICTION;

            if(speed < 0){
                speed = 0;
            }
        }
        else if(speed < 0){

            speed += FRICTION;

            if(speed > 0){
                speed = 0;
            }
        }
    }

    // Handbrake

    if(keys.space){

        if(speed > 0){
            speed -= BRAKING * 2;
        }

        if(speed < 0){
            speed += BRAKING * 2;
        }

        if(Math.abs(speed) < 0.1){
            speed = 0;
        }
    }

    // Speed Limit

    speed = Math.max(
        -maxSpeedLimit / 2,
        Math.min(speed, maxSpeedLimit)
    );

    // Steering

    if(Math.abs(speed) > 0.05){

        let steerFactor =
            (speed > 0) ? 1 : -1;

        if(keys.a){
            steeringAngle += TURN_SPEED * steerFactor;
        }

        if(keys.d){
            steeringAngle -= TURN_SPEED * steerFactor;
        }
    }

    // Steering Friction

    if(!keys.a && !keys.d){
        steeringAngle *= 0.8;
    }

    steeringAngle = Math.max(
        -0.6,
        Math.min(steeringAngle,0.6)
    );

    // Rotation

    carGroup.rotation.y +=
        steeringAngle * Math.abs(speed) * 0.1;

    // Movement

    carGroup.position.x +=
        Math.sin(carGroup.rotation.y) * speed;

    carGroup.position.z +=
        Math.cos(carGroup.rotation.y) * speed;

    // Wheel Animation

    wheels.forEach((wheel,index)=>{

        wheel.rotation.x += speed * 0.5;

        if(index < 2){
            wheel.rotation.y = steeringAngle;
        }
    });

    // Speed HUD

    let displaySpeed = Math.round(
        Math.abs(speed) / maxSpeedLimit * 200
    );

    speedEl.innerText = displaySpeed;

    // Camera Follow

    const relativeCameraOffset =
        new THREE.Vector3(0,4,-12);

    const cameraOffset =
        relativeCameraOffset.applyMatrix4(
            carGroup.matrixWorld
        );

    camera.position.lerp(cameraOffset,0.1);

    const lookAtTarget =
        new THREE.Vector3(0,1,5)
        .applyMatrix4(carGroup.matrixWorld);

    camera.lookAt(lookAtTarget);

    renderer.render(scene,camera);
}
