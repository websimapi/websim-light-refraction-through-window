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

// Raycaster for ray selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 1.5;

// Global variables for simulation
let rayGroup, window3D, lightSource, roomWalls, pointLight;
let refractionIndex = 1.5;
let rayCount = 15;
let windowAngle = 0;
let windowFrame;
let lightColor = 0xffff99;
let lightIntensity = 1.5;
let selectedRay = null;
let selectedRayIndex = -1;
let showRayAngles = false;
let rayDetailsData = [];
let currentTab = 'general';

// Initialize scene and rays
initScene();
updateRays();

// Initialize UI elements
initUI();

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

// Light position controls
document.getElementById('lightX').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('lightXValue').textContent = value.toFixed(1);
    updateLightPosition('x', value);
});

document.getElementById('lightY').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('lightYValue').textContent = value.toFixed(1);
    updateLightPosition('y', value);
});

document.getElementById('lightZ').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('lightZValue').textContent = value.toFixed(1);
    updateLightPosition('z', value);
});

// Light properties controls
document.getElementById('lightIntensity').addEventListener('input', function() {
    lightIntensity = parseFloat(this.value);
    document.getElementById('lightIntensityValue').textContent = lightIntensity.toFixed(1);
    updateLightProperties();
});

document.getElementById('lightColor').addEventListener('input', function() {
    const colorValue = this.value;
    document.getElementById('lightColorValue').textContent = colorValue;
    lightColor = new THREE.Color(colorValue);
    updateLightProperties();
});

document.getElementById('showRayAngles').addEventListener('change', function() {
    showRayAngles = this.checked;
    document.getElementById('ray-details-container').style.display = 
        showRayAngles ? 'block' : 'none';
    if (showRayAngles && selectedRayIndex >= 0) {
        updateRayDetails(selectedRayIndex);
    }
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

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mouse move event for ray interaction
window.addEventListener('mousemove', onMouseMove);

// Mouse click for ray selection
window.addEventListener('click', onMouseClick);

function initUI() {
    // Initialize collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            content.classList.toggle('expanded');
            this.querySelector('.toggle').textContent = 
                content.classList.contains('expanded') ? '▼' : '►';
        });
    });

    // Initialize tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            
            if (selectedRayIndex >= 0) {
                updateRayDetails(selectedRayIndex);
            }
        });
    });

    // Set initial values for light controls
    document.getElementById('lightXValue').textContent = "-5.0";
    document.getElementById('lightYValue').textContent = "1.5";
    document.getElementById('lightZValue').textContent = "0.0";
    document.getElementById('lightIntensityValue').textContent = "1.5";
    document.getElementById('lightColorValue').textContent = "#ffff99";
}

function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Only do ray casting if we're showing ray details
    if (showRayAngles) {
        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);

        // Calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(rayGroup.children);
        
        if (intersects.length > 0) {
            // Find the index of the ray
            const rayLine = intersects[0].object;
            const rayIndex = Math.floor(rayGroup.children.indexOf(rayLine) / 3);
            
            if (rayIndex >= 0 && rayIndex < rayCount) {
                // Highlight the ray if it's not the selected one
                if (selectedRayIndex !== rayIndex) {
                    if (selectedRay) {
                        unhighlightRay(selectedRayIndex);
                    }
                    highlightRay(rayIndex);
                    selectedRayIndex = rayIndex;
                    updateRayDetails(rayIndex);
                }
                return;
            }
        }
        
        // If no ray is intersected and we have a selectedRay, unhighlight it
        if (selectedRay && !event.buttons) {
            unhighlightRay(selectedRayIndex);
            selectedRay = null;
            selectedRayIndex = -1;
            document.getElementById('ray-details').textContent = "Select a ray or hover over one to see details";
        }
    }
}

function onMouseClick(event) {
    if (!showRayAngles) return;
    
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(rayGroup.children);
    
    if (intersects.length > 0) {
        // Find the ray that was clicked
        const rayLine = intersects[0].object;
        const rayIndex = Math.floor(rayGroup.children.indexOf(rayLine) / 3);
        
        if (rayIndex >= 0 && rayIndex < rayCount) {
            // If clicking on already selected ray, toggle selection off
            if (selectedRayIndex === rayIndex && selectedRay) {
                unhighlightRay(selectedRayIndex);
                selectedRay = null;
                selectedRayIndex = -1;
                document.getElementById('ray-details').textContent = "Select a ray or hover over one to see details";
            } else {
                // Otherwise, select this ray
                if (selectedRay) {
                    unhighlightRay(selectedRayIndex);
                }
                highlightRay(rayIndex);
                selectedRay = rayLine;
                selectedRayIndex = rayIndex;
                updateRayDetails(rayIndex);
            }
        }
    }
}

function highlightRay(rayIndex) {
    // Highlight all segments of this ray
    const baseIndex = rayIndex * 3;
    for (let i = 0; i < 3; i++) {
        if (rayGroup.children[baseIndex + i]) {
            // Store original line width and color
            const line = rayGroup.children[baseIndex + i];
            if (!line.userData.originalWidth) {
                line.userData.originalWidth = line.material.linewidth;
                line.userData.originalColor = line.material.color.clone();
            }
            
            // Make the line thicker and brighter
            line.material.linewidth = line.userData.originalWidth * 2;
            line.material.color.lerp(new THREE.Color(1, 1, 1), 0.5);
        }
    }
}

function unhighlightRay(rayIndex) {
    // Restore original appearance
    const baseIndex = rayIndex * 3;
    for (let i = 0; i < 3; i++) {
        if (rayGroup.children[baseIndex + i]) {
            const line = rayGroup.children[baseIndex + i];
            if (line.userData.originalWidth) {
                line.material.linewidth = line.userData.originalWidth;
                line.material.color.copy(line.userData.originalColor);
            }
        }
    }
}

function updateRayDetails(rayIndex) {
    if (!showRayAngles || rayIndex < 0 || rayIndex >= rayDetailsData.length) {
        return;
    }
    
    const rayData = rayDetailsData[rayIndex];
    let detailsText = "";
    
    if (currentTab === 'general') {
        detailsText = `Ray #${rayIndex + 1}\n`;
        detailsText += `Source: (${formatCoord(rayData.source.x)}, ${formatCoord(rayData.source.y)}, ${formatCoord(rayData.source.z)})\n`;
        detailsText += `Window Entry: (${formatCoord(rayData.entryPoint.x)}, ${formatCoord(rayData.entryPoint.y)}, ${formatCoord(rayData.entryPoint.z)})\n`;
        
        if (rayData.exitPoint) {
            detailsText += `Window Exit: (${formatCoord(rayData.exitPoint.x)}, ${formatCoord(rayData.exitPoint.y)}, ${formatCoord(rayData.exitPoint.z)})\n`;
        }
        
        if (rayData.endPoint) {
            detailsText += `End Point: (${formatCoord(rayData.endPoint.x)}, ${formatCoord(rayData.endPoint.y)}, ${formatCoord(rayData.endPoint.z)})\n`;
        }
        
        detailsText += `Total Distance: ${formatCoord(rayData.totalDistance)} units\n`;
    } else {
        detailsText = `Ray #${rayIndex + 1} Calculations\n`;
        detailsText += `Incident Ray Direction: (${formatCoord(rayData.incidentDirection.x)}, ${formatCoord(rayData.incidentDirection.y)}, ${formatCoord(rayData.incidentDirection.z)})\n`;
        detailsText += `Surface Normal: (${formatCoord(rayData.normal.x)}, ${formatCoord(rayData.normal.y)}, ${formatCoord(rayData.normal.z)})\n`;
        detailsText += `Angle of Incidence: ${formatCoord(rayData.incidentAngle)}°\n`;
        
        if (rayData.refractedDirection) {
            detailsText += `Refracted Ray Direction: (${formatCoord(rayData.refractedDirection.x)}, ${formatCoord(rayData.refractedDirection.y)}, ${formatCoord(rayData.refractedDirection.z)})\n`;
            detailsText += `Angle of Refraction: ${formatCoord(rayData.refractionAngle)}°\n`;
            detailsText += `n₁ (Air): 1.0, n₂ (Material): ${refractionIndex.toFixed(2)}\n`;
            
            if (rayData.finalDirection) {
                detailsText += `Final Ray Direction: (${formatCoord(rayData.finalDirection.x)}, ${formatCoord(rayData.finalDirection.y)}, ${formatCoord(rayData.finalDirection.z)})\n`;
                detailsText += `Second Angle of Refraction: ${formatCoord(rayData.finalRefractionAngle)}°\n`;
            }
        }
        
        if (rayData.totalInternalReflection) {
            detailsText += "Total Internal Reflection Occurred\n";
        }
    }
    
    document.getElementById('ray-details').textContent = detailsText;
}

function formatCoord(value) {
    if (typeof value !== 'number') return 'N/A';
    return value.toFixed(2);
}

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

function updateLightPosition(axis, value) {
    switch(axis) {
        case 'x':
            lightSource.position.x = value;
            break;
        case 'y':
            lightSource.position.y = value;
            break;
        case 'z':
            lightSource.position.z = value;
            break;
    }
    
    // Update point light position
    if (pointLight) {
        pointLight.position.copy(lightSource.position);
    }
    
    // Update rays when light moves
    updateRays();
}

function updateLightProperties() {
    // Update light material
    if (lightSource) {
        lightSource.material.color.copy(lightColor);
        lightSource.material.emissive.copy(lightColor);
    }
    
    // Update point light color and intensity
    if (pointLight) {
        pointLight.color.copy(lightColor);
        pointLight.intensity = lightIntensity;
    }
    
    // Update rays
    updateRays();
}

function initScene() {
    // Create a simple room
    createRoom();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x505050);
    scene.add(ambientLight);

    // Create light source (visualization and actual light source combined)
    const sourceGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const sourceMaterial = new THREE.MeshBasicMaterial({ 
        color: lightColor,
        emissive: lightColor,
        emissiveIntensity: 1.5
    });
    lightSource = new THREE.Mesh(sourceGeometry, sourceMaterial);
    lightSource.position.set(-5, 1.5, 0);
    scene.add(lightSource);
    
    // Add point light at source - this will be our main shadow-casting light
    pointLight = new THREE.PointLight(lightColor, lightIntensity, 20);
    pointLight.position.copy(lightSource.position);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.shadow.camera.near = 0.1;
    pointLight.shadow.camera.far = 25;
    pointLight.shadow.bias = -0.001;
    scene.add(pointLight);
    
    // Secondary fill light - reduced intensity and no shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight.position.set(3, 5, 3);
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
    
    // Reset ray details data
    rayDetailsData = [];
    
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
        const { rayPaths, rayData } = simulateRay(sourcePos, direction, refractionIndex);
        
        // Store ray details data
        rayDetailsData.push(rayData);
        
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
            line.userData.rayIndex = i;
            line.userData.segmentIndex = j;
            rayGroup.add(line);
        }
    }
    
    // Update ray details if a ray is selected
    if (showRayAngles && selectedRayIndex >= 0 && selectedRayIndex < rayDetailsData.length) {
        updateRayDetails(selectedRayIndex);
    }
}

function simulateRay(origin, direction, refractionIdx) {
    const rayPoints = [origin.clone()];
    let rayData = {
        source: origin.clone(),
        incidentDirection: direction.clone(),
        totalDistance: 0
    };
    
    // Calculate intersection with window
    const raycaster = new THREE.Raycaster(origin, direction);
    const intersects = raycaster.intersectObject(window3D);
    
    if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        rayPoints.push(hitPoint.clone());
        
        // Calculate entry point distance
        rayData.entryPoint = hitPoint.clone();
        rayData.distanceToEntry = origin.distanceTo(hitPoint);
        rayData.totalDistance += rayData.distanceToEntry;
        
        // Calculate normal at intersection (account for window rotation)
        const normal = new THREE.Vector3(1, 0, 0);
        normal.applyQuaternion(window3D.quaternion);
        
        if (normal.dot(direction) > 0) {
            normal.negate(); // Ensure normal points toward incoming ray
        }
        
        // Store normal and calculate incident angle
        rayData.normal = normal.clone();
        
        // Calculate angle between incident ray and normal
        rayData.incidentAngle = Math.acos(Math.abs(normal.dot(direction))) * 180 / Math.PI;
        
        // Calculate refracted direction using Snell's Law
        const incident = direction.clone();
        const refracted = refract(incident, normal, 1.0, refractionIdx);
        
        // Check for total internal reflection
        rayData.totalInternalReflection = refracted.equals(incident.clone().reflect(normal));
        
        // Store refracted direction and calculate refraction angle
        rayData.refractedDirection = refracted.clone();
        rayData.refractionAngle = Math.acos(Math.abs(normal.dot(refracted))) * 180 / Math.PI;
        
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
            
            // Store exit point and distance through window
            rayData.exitPoint = exitPoint.clone();
            rayData.distanceThroughWindow = hitPoint.distanceTo(exitPoint);
            rayData.totalDistance += rayData.distanceThroughWindow;
            
            // Calculate refraction going from glass back to air
            const exitNormal = normal.clone().negate();
            const finalDirection = refract(refracted, exitNormal, refractionIdx, 1.0);
            
            // Store final direction and calculate final refraction angle
            rayData.finalDirection = finalDirection.clone();
            rayData.finalRefractionAngle = Math.acos(Math.abs(exitNormal.dot(finalDirection))) * 180 / Math.PI;
            
            // Check for potential wall hit for more realistic visualization
            const wallRaycaster = new THREE.Raycaster(exitPoint, finalDirection);
            const wallIntersects = wallRaycaster.intersectObject(roomWalls, true);
            
            if (wallIntersects.length > 0) {
                const wallHitPoint = wallIntersects[0].point;
                rayPoints.push(wallHitPoint.clone());
                
                // Store end point and final distance
                rayData.endPoint = wallHitPoint.clone();
                rayData.distanceToWall = exitPoint.distanceTo(wallHitPoint);
                rayData.totalDistance += rayData.distanceToWall;
                rayData.hitObject = "wall";
            } else {
                // If no wall hit, extend ray to a reasonable distance
                const extendedPoint = exitPoint.clone().add(finalDirection.multiplyScalar(15));
                rayPoints.push(extendedPoint.clone());
                
                // Store extended end point and distance
                rayData.endPoint = extendedPoint.clone();
                rayData.distanceExtended = 15;
                rayData.totalDistance += rayData.distanceExtended;
                rayData.hitObject = "none";
            }
        } else {
            // If no exit point (shouldn't normally happen), just extend the refracted ray
            const extendedPoint = hitPoint.clone().add(refracted.multiplyScalar(15));
            rayPoints.push(extendedPoint.clone());
            
            // Store extended end point
            rayData.endPoint = extendedPoint.clone();
            rayData.distanceExtended = 15;
            rayData.totalDistance += rayData.distanceExtended;
            rayData.hitObject = "none (no exit)";
        }
    } else {
        // If ray doesn't hit window, check if it hits a wall
        const wallRaycaster = new THREE.Raycaster(origin, direction);
        const wallIntersects = wallRaycaster.intersectObject(roomWalls, true);
        
        if (wallIntersects.length > 0) {
            const wallHitPoint = wallIntersects[0].point;
            rayPoints.push(wallHitPoint.clone());
            
            // Store direct wall hit
            rayData.endPoint = wallHitPoint.clone();
            rayData.distanceToWall = origin.distanceTo(wallHitPoint);
            rayData.totalDistance += rayData.distanceToWall;
            rayData.hitObject = "wall direct";
        } else {
            // If no wall hit, extend it in its original direction
            const extendedPoint = origin.clone().add(direction.multiplyScalar(15));
            rayPoints.push(extendedPoint.clone());
            
            // Store extended end point
            rayData.endPoint = extendedPoint.clone();
            rayData.distanceExtended = 15;
            rayData.totalDistance += rayData.distanceExtended;
            rayData.hitObject = "none (missed window)";
        }
    }
    
    return { rayPaths: rayPoints, rayData };
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