import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Camera setup
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Global variables for simulation
let rayGroup, window3D, lightSource;
let refractionIndex = 1.5;
let rayCount = 20;
let windowAngle = 0;

// Initialize ray lines and window
initScene();
updateRays();

// Event listeners for controls
document.getElementById('refractionIndex').addEventListener('input', function() {
    refractionIndex = parseFloat(this.value);
    document.getElementById('refractionValue').textContent = refractionIndex.toFixed(2);
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
    window3D.rotation.y = windowAngle * Math.PI / 180;
    updateRays();
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function initScene() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create window (glass pane)
    const windowGeometry = new THREE.BoxGeometry(4, 4, 0.1);
    const windowMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.2,
        transmission: 0.9,
        roughness: 0,
        metalness: 0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide
    });
    window3D = new THREE.Mesh(windowGeometry, windowMaterial);
    scene.add(window3D);

    // Add window frame
    const frameGeometry = new THREE.BoxGeometry(4.4, 4.4, 0.3);
    const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const frameMesh = new THREE.Mesh(frameGeometry, holeMaterial);
    
    // Create hole in frame
    const windowHole = new THREE.BoxGeometry(4, 4, 0.5);
    const holeMesh = new THREE.Mesh(windowHole);
    holeMesh.updateMatrix();
    frameMesh.geometry = CSG.subtract(frameMesh.geometry, holeMesh.geometry);
    
    scene.add(frameMesh);

    // Create light source
    const sourceGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const sourceMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    lightSource = new THREE.Mesh(sourceGeometry, sourceMaterial);
    lightSource.position.set(-5, 0, 0);
    scene.add(lightSource);

    // Create group for rays
    rayGroup = new THREE.Group();
    scene.add(rayGroup);

    // Add grid for reference
    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -3;
    scene.add(gridHelper);
}

function updateRays() {
    // Clear existing rays
    while(rayGroup.children.length > 0) {
        rayGroup.remove(rayGroup.children[0]);
    }

    const sourcePos = lightSource.position.clone();
    
    // Create rays
    for (let i = 0; i < rayCount; i++) {
        // Calculate a direction for the ray with some spread
        const angle = (i - rayCount/2) * 0.05;
        const direction = new THREE.Vector3(1, angle, angle * 0.7).normalize();
        
        // Cast the ray and calculate refraction
        const rayPaths = simulateRay(sourcePos, direction, refractionIndex);
        
        // Create visible rays
        for (let j = 0; j < rayPaths.length - 1; j++) {
            const points = [rayPaths[j], rayPaths[j+1]];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            let material;
            if (j === 0) {
                // Incident ray (before refraction)
                material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
            } else {
                // Refracted ray
                material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
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
        
        // Calculate refracted direction using Snell's Law
        const incident = direction.clone();
        const refracted = refract(incident, normal, 1.0, refractionIdx);
        
        // Find exit point on the other side of the window
        const exitRaycaster = new THREE.Raycaster(hitPoint.clone().add(refracted.clone().multiplyScalar(0.11)), refracted);
        const exitIntersects = exitRaycaster.intersectObject(window3D);
        
        if (exitIntersects.length > 0) {
            const exitPoint = exitIntersects[0].point;
            rayPoints.push(exitPoint.clone());
            
            // Calculate refraction going from glass back to air
            const exitNormal = normal.clone().negate();
            const finalDirection = refract(refracted, exitNormal, refractionIdx, 1.0);
            
            // Extend the ray to make it visible
            rayPoints.push(exitPoint.clone().add(finalDirection.multiplyScalar(10)));
        } else {
            // If no exit point (shouldn't normally happen), just extend the refracted ray
            rayPoints.push(hitPoint.clone().add(refracted.multiplyScalar(10)));
        }
    } else {
        // If ray doesn't hit window, just extend it in its original direction
        rayPoints.push(origin.clone().add(direction.multiplyScalar(10)));
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

// CSG operations for creating the window frame
const CSG = {
    subtract: function(geometry1, geometry2) {
        // Simple implementation for demonstration
        // In a real application, you would use a CSG library
        // This is a simplified approach that creates a frame-like effect
        return new THREE.BoxGeometry(4.4, 4.4, 0.3).toNonIndexed();
    }
};

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

