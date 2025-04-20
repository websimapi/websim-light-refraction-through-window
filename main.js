import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

// Camera setup
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 10);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 1.5;

// Global variables for simulation
let rayGroup, window3D, lightSource, roomWalls;
let refractionIndex = 1.5;
let rayCount = 15;
let windowAngle = 0;
let windowFrame;

// Initialize scene and rays
initScene();
updateRays();

// Event listeners for controls
document.getElementById('refractionIndex').addEventListener('input', function() {
    refractionIndex = parseFloat(this.value);
    document.getElementById('refractionValue').textContent = refractionIndex.toFixed(2);
    updateWindowAppearance();
    updateRays();
});

document.getElementById('rayCount').addEventListener('input', function() {
    rayCount = parseInt(this.value);
    document.getElementById('rayCountValue').textContent = rayCount;
    updateRays();
});

document.getElementById('windowAngle').addEventListener('input', function() {
    windowAngle = parseInt(this.value);
    document.getElementById('windowAngleValue').textContent = windowAngle + '°';
    updateWindowOrientation();
    updateRays();
});

// Preset buttons
document.getElementById('preset-normal').addEventListener('click', function() {
    setPreset(1.5, 15, 0);
});

document.getElementById('preset-water').addEventListener('click', function() {
    setPreset(1.33, 20, 10);
});

document.getElementById('preset-diamond').addEventListener('click', function() {
    setPreset(2.4, 25, 30);
});

function setPreset(refIndex, rays, angle) {
    refractionIndex = refIndex;
    rayCount = rays;
    windowAngle = angle;
    
    // Update UI controls
    document.getElementById('refractionIndex').value = refIndex;
    document.getElementById('refractionValue').textContent = refIndex.toFixed(2);
    
    document.getElementById('rayCount').value = rays;
    document.getElementById('rayCountValue').textContent = rays;
    
    document.getElementById('windowAngle').value = angle;
    document.getElementById('windowAngleValue').textContent = angle + '°';
    
    // Update the scene
    updateWindowAppearance();
    updateWindowOrientation();
    updateRays();
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function initScene() {
    // Create a simple room
    createRoom();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x505050);
    scene.add(ambientLight);

    // Add directional light (main light)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    scene.add(mainLight);
    
    // Additional fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // Create window (glass pane)
    const windowGeometry = new THREE.BoxGeometry(5, 3, 0.1);
    const windowMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.2,
        transmission: 0.95,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide
    });
    window3D = new THREE.Mesh(windowGeometry, windowMaterial);
    window3D.position.set(0, 1.5, 0); // Place at room center
    window3D.castShadow = true;
    window3D.receiveShadow = true;
    scene.add(window3D);

    // Create window frame
    createWindowFrame();

    // Create light source (better visualization)
    const sourceGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const sourceMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 1.5
    });
    lightSource = new THREE.Mesh(sourceGeometry, sourceMaterial);
    lightSource.position.set(-5, 1.5, 0);
    scene.add(lightSource);
    
    // Add point light at source
    const pointLight = new THREE.PointLight(0xffff99, 1, 10);
    pointLight.position.copy(lightSource.position);
    scene.add(pointLight);

    // Create group for rays
    rayGroup = new THREE.Group();
    scene.add(rayGroup);
}

function createRoom() {
    roomWalls = new THREE.Group();
    
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(15, 15);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333344,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    roomWalls.add(floor);
    
    // Back wall
    const backWallGeometry = new THREE.PlaneGeometry(15, 8);
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555566,
        roughness: 0.7
    });
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.z = -7.5;
    backWall.position.y = 4;
    backWall.receiveShadow = true;
    roomWalls.add(backWall);
    
    // Left wall
    const leftWallGeometry = new THREE.PlaneGeometry(15, 8);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.x = -7.5;
    leftWall.position.y = 4;
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    roomWalls.add(leftWall);
    
    // Right wall
    const rightWallGeometry = new THREE.PlaneGeometry(15, 8);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.x = 7.5;
    rightWall.position.y = 4;
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    roomWalls.add(rightWall);
    
    scene.add(roomWalls);
}

function createWindowFrame() {
    if (windowFrame) {
        scene.remove(windowFrame);
    }
    
    windowFrame = new THREE.Group();
    
    const frameMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x5c3a21,
        roughness: 0.7,
        metalness: 0.2
    });
    
    // Frame dimensions
    const frameThickness = 0.2;
    const frameWidth = 0.3;
    const windowSizeX = 5;
    const windowSizeY = 3;
    
    // Top
    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(windowSizeX + (frameWidth * 2), frameWidth, frameThickness * 2),
        frameMaterial
    );
    topFrame.position.y = (windowSizeY / 2) + (frameWidth / 2);
    topFrame.castShadow = true;
    windowFrame.add(topFrame);
    
    // Bottom
    const bottomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(windowSizeX + (frameWidth * 2), frameWidth, frameThickness * 2),
        frameMaterial
    );
    bottomFrame.position.y = -(windowSizeY / 2) - (frameWidth / 2);
    bottomFrame.castShadow = true;
    windowFrame.add(bottomFrame);
    
    // Left
    const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, windowSizeY, frameThickness * 2),
        frameMaterial
    );
    leftFrame.position.x = -(windowSizeX / 2) - (frameWidth / 2);
    leftFrame.castShadow = true;
    windowFrame.add(leftFrame);
    
    // Right
    const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, windowSizeY, frameThickness * 2),
        frameMaterial
    );
    rightFrame.position.x = (windowSizeX / 2) + (frameWidth / 2);
    rightFrame.castShadow = true;
    windowFrame.add(rightFrame);
    
    // Center divider (horizontal)
    const centerH = new THREE.Mesh(
        new THREE.BoxGeometry(windowSizeX, frameWidth * 0.8, frameThickness * 2),
        frameMaterial
    );
    centerH.castShadow = true;
    windowFrame.add(centerH);
    
    // Center divider (vertical)
    const centerV = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth * 0.8, windowSizeY, frameThickness * 2),
        frameMaterial
    );
    centerV.castShadow = true;
    windowFrame.add(centerV);
    
    // Position the entire frame at window position
    windowFrame.position.copy(window3D.position);
    windowFrame.rotation.copy(window3D.rotation);
    
    scene.add(windowFrame);
}

function updateWindowAppearance() {
    // Adjust window appearance based on refraction index
    const windowMaterial = window3D.material;
    
    // Higher refraction = more blue, more dense look
    const blueIntensity = Math.min(0.5, (refractionIndex - 1) * 0.4);
    windowMaterial.color.setRGB(0.5 - blueIntensity, 0.8, 0.9 + blueIntensity);
    
    // Higher refraction = slightly less transparent
    windowMaterial.opacity = 0.2 + (refractionIndex - 1) * 0.15;
    
    // Higher refraction = higher clarity, lower roughness
    windowMaterial.roughness = Math.max(0, 0.08 - (refractionIndex - 1) * 0.03);
    
    // Update the material
    windowMaterial.needsUpdate = true;
}

function updateWindowOrientation() {
    // Update window and frame rotation
    window3D.rotation.y = windowAngle * Math.PI / 180;
    
    // Update frame position and rotation
    if (windowFrame) {
        windowFrame.rotation.y = windowAngle * Math.PI / 180;
    }
}

function updateRays() {
    // Clear existing rays
    while(rayGroup.children.length > 0) {
        rayGroup.remove(rayGroup.children[0]);
    }

    const sourcePos = lightSource.position.clone();
    
    // Create rays
    for (let i = 0; i < rayCount; i++) {
        // Calculate a direction for the ray with an appealing spread pattern
        const yOffset = (i - rayCount/2) * (3.0 / rayCount);
        const zOffset = Math.sin((i / rayCount) * Math.PI) * 0.5;
        
        // Target a point on the window with some spread
        const targetPoint = new THREE.Vector3(
            window3D.position.x, 
            window3D.position.y + yOffset, 
            window3D.position.z + zOffset
        );
        
        // Calculate direction from source to target
        const direction = new THREE.Vector3()
            .subVectors(targetPoint, sourcePos)
            .normalize();
        
        // Cast the ray and calculate refraction
        const rayPaths = simulateRay(sourcePos, direction, refractionIndex);
        
        // Create visible rays
        for (let j = 0; j < rayPaths.length - 1; j++) {
            const points = [rayPaths[j], rayPaths[j+1]];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            let material;
            if (j === 0) {
                // Incident ray (before refraction)
                material = new THREE.LineBasicMaterial({ 
                    color: 0xffff00, 
                    linewidth: 2,
                });
            } else {
                // Refracted ray
                material = new THREE.LineBasicMaterial({ 
                    color: 0x00ffff, 
                    linewidth: 2,
                });
            }
            
            const line = new THREE.Line(geometry, material);
            rayGroup.add(line);
        }
    }
}

function simulateRay(origin, direction, refractionIdx) {
    const rayPoints = [origin.clone()];
    
    // Calculate intersection with window
    const raycaster = new THREE.Raycaster(origin, direction);
    const intersects = raycaster.intersectObject(window3D);
    
    if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        rayPoints.push(hitPoint.clone());
        
        // Calculate normal at intersection (account for window rotation)
        const normal = new THREE.Vector3(1, 0, 0);
        normal.applyQuaternion(window3D.quaternion);
        
        if (normal.dot(direction) > 0) {
            normal.negate(); // Ensure normal points toward incoming ray
        }
        
        // Calculate refracted direction using Snell's Law
        const incident = direction.clone();
        const refracted = refract(incident, normal, 1.0, refractionIdx);
        
        // Find exit point on the other side of the window
        const epsilon = 0.11; // Small offset to avoid self-intersection
        const exitRaycaster = new THREE.Raycaster(
            hitPoint.clone().add(refracted.clone().multiplyScalar(epsilon)), 
            refracted
        );
        const exitIntersects = exitRaycaster.intersectObject(window3D);
        
        if (exitIntersects.length > 0) {
            const exitPoint = exitIntersects[0].point;
            rayPoints.push(exitPoint.clone());
            
            // Calculate refraction going from glass back to air
            const exitNormal = normal.clone().negate();
            const finalDirection = refract(refracted, exitNormal, refractionIdx, 1.0);
            
            // Check for potential wall hit for more realistic visualization
            const wallRaycaster = new THREE.Raycaster(exitPoint, finalDirection);
            const wallIntersects = wallRaycaster.intersectObject(roomWalls, true);
            
            if (wallIntersects.length > 0) {
                rayPoints.push(wallIntersects[0].point);
            } else {
                // If no wall hit, extend ray to a reasonable distance
                rayPoints.push(exitPoint.clone().add(finalDirection.multiplyScalar(15)));
            }
        } else {
            // If no exit point (shouldn't normally happen), just extend the refracted ray
            rayPoints.push(hitPoint.clone().add(refracted.multiplyScalar(15)));
        }
    } else {
        // If ray doesn't hit window, check if it hits a wall
        const wallRaycaster = new THREE.Raycaster(origin, direction);
        const wallIntersects = wallRaycaster.intersectObject(roomWalls, true);
        
        if (wallIntersects.length > 0) {
            rayPoints.push(wallIntersects[0].point);
        } else {
            // If no wall hit, extend it in its original direction
            rayPoints.push(origin.clone().add(direction.multiplyScalar(15)));
        }
    }
    
    return rayPoints;
}

// Function to calculate refraction direction based on Snell's law
function refract(incident, normal, n1, n2) {
    const incidentCopy = incident.clone();
    const normalCopy = normal.clone();
    
    const n = n1 / n2;
    const cosI = -normalCopy.dot(incidentCopy);
    const sinT2 = n * n * (1.0 - cosI * cosI);
    
    if (sinT2 > 1.0) {
        // Total internal reflection
        return incident.clone().reflect(normalCopy);
    }
    
    const cosT = Math.sqrt(1.0 - sinT2);
    return incidentCopy.multiplyScalar(n).add(normalCopy.multiplyScalar(n * cosI - cosT));
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();