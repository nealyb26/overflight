import * as THREE from 'three'
import './style.css'
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {CSS2DRenderer, CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls"

//scene
const scene = new THREE.Scene();
// MAP API KEY
// const apiKey = import.meta.env.VITE_API_KEY;
const apiKey = import.meta.env.VITE_GEOAPIFY_KEY;

// API Base URL dynamically set based on current environment
const API_BASE_URL = "https://overflight-container-681855981049.us-central1.run.app"
  //: 'http://127.0.0.1:5000' // Local development
  //: 'https://overflight-container-681855981049.us-central1.run.app'; // Cloud Run URL

//plane model
let model = null;
//user longitude and latitude
let lat0 = 34.1184
let long0 = -118.3004
let groundMesh = null;

//constants for distance conversion
const EARTH_CIRCUMFERENCE_KM = 40075.0;
const DEGREES = 360.0;
const KM_PER_DEGREE =  EARTH_CIRCUMFERENCE_KM / DEGREES;

// assuming that each unit in the plane represents 10 km
const SCALE_FACTOR = 20;

//creating a wire box
//2 x 2 x 2 wire mesh box
var geometry = new THREE.BoxGeometry( 2, 2, 2)
var material = new THREE.MeshNormalMaterial( {wireframe: true, transparent: true})
var cubeMesh = new THREE.Mesh ( geometry, material )
cubeMesh.position.y += 1;
var helper = new THREE.BoxHelper( cubeMesh )
helper.update();
scene.add( helper )


//creating center point representing user location
var userPoint = new THREE.SphereGeometry(0.03);
var mat = new THREE.MeshBasicMaterial({color: 0xFF0000});
var mesh = new THREE.Mesh(userPoint, mat);
mesh.position.set(0,0,0);
scene.add(mesh);

// ambient light
var ambientLight = new THREE.AmbientLight ( 0xffffff, 0.5)
scene.add( ambientLight )

// point light - white in color
var pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
pointLight.position.set( 0, 1.2, 0 );
scene.add( pointLight );

//camera
//FOV, Aspect Ratio are parameters
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
//camera.position.z = 8 //moving camera back a few units
camera.position.set(4, 6, 6); // x, y, z
// Make the camera look at the object
camera.lookAt(cubeMesh);
scene.add( camera )

// renderer
const canvas = document.querySelector('.webgl')
const renderer = new THREE.WebGLRenderer({canvas, antialias: true})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.render( scene, camera )

//labelRenderer creation
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.pointerEvents = 'none'; //preventing container from capturing mouse events
labelRenderer.domElement.style.zIndex = '1';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.color = "white"
labelRenderer.domElement.style.fontSize = "small"
document.body.appendChild(labelRenderer.domElement);

//controls
const controls = new OrbitControls(camera, canvas)
controls.enablePan = false //region always centered
//controls.enableZoom = false //no scroll to zoom

controls.target.copy(cubeMesh.position).add(new THREE.Vector3(0, -0.2, 0));
controls.update();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectedPlaneKey = null;

const TRAIL_MIN_DISTANCE = 0.015;
const TRAIL_MAX_POINTS = 500;
const TRAIL_SAMPLE_INTERVAL_MS = 200;
const trailPointsByKey = new Map();
let selectedTrailLine = null;
let lastTrailSampleTime = 0;

const infoEmptyEl = document.querySelector('#flight-info-empty');
const infoGridEl = document.querySelector('#flight-info-grid');
const infoPanelEl = document.querySelector('#flight-info-panel');
const callsignEl = document.querySelector('#flight-callsign');
const aircraftEl = document.querySelector('#flight-aircraft');
const originEl = document.querySelector('#flight-origin');
const destinationEl = document.querySelector('#flight-destination');
const speedEl = document.querySelector('#flight-speed');
const altitudeEl = document.querySelector('#flight-altitude');
const statusEl = document.querySelector('#flight-status');
const delayEl = document.querySelector('#flight-delay');
const testLatEl = document.querySelector('#test-lat');
const testLonEl = document.querySelector('#test-lon');
const applyTestLocationBtn = document.querySelector('#apply-test-location');
const useCurrentLocationBtn = document.querySelector('#use-current-location');

function formatValue(value, suffix = '') {
	if (value === null || value === undefined || value === '') return 'N/A';
	return `${value}${suffix}`;
}

function formatAirport(name, iata) {
	if (name && iata) return `${name} (${iata})`;
	if (name) return name;
	if (iata) return iata;
	return 'N/A';
}

function setInfoPanel(plane) {
	if (!plane) {
		if (infoPanelEl) infoPanelEl.classList.add('hidden');
		if (infoGridEl) infoGridEl.classList.add('hidden');
		if (infoEmptyEl) infoEmptyEl.classList.remove('hidden');
		return;
	}

	if (infoPanelEl) infoPanelEl.classList.remove('hidden');
	if (infoEmptyEl) infoEmptyEl.classList.add('hidden');
	if (infoGridEl) infoGridEl.classList.remove('hidden');

	if (callsignEl) callsignEl.textContent = formatValue(plane.callsign);
	if (aircraftEl) aircraftEl.textContent = formatValue(plane.aircraft_type);
	if (originEl) originEl.textContent = formatAirport(plane.origin_airport, plane.origin_iata);
	if (destinationEl) destinationEl.textContent = formatAirport(plane.destination_airport, plane.destination_iata);
	if (speedEl) speedEl.textContent = formatValue(plane.speed, ' kt');
	if (altitudeEl) altitudeEl.textContent = formatValue(plane.altitude, ' ft');
	if (statusEl) statusEl.textContent = formatValue(plane.status_text);
	if (delayEl) delayEl.textContent = formatValue(plane.delay_state);
}

function clearSelectedTrailLine() {
	if (!selectedTrailLine) return;
	scene.remove(selectedTrailLine);
	if (selectedTrailLine.geometry) selectedTrailLine.geometry.dispose();
	if (selectedTrailLine.material) selectedTrailLine.material.dispose();
	selectedTrailLine = null;
}

function drawSelectedTrail(points) {
	if (!points || points.length < 2) {
		clearSelectedTrailLine();
		return;
	}

	if (!selectedTrailLine) {
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial({
			color: 0xffde21,
			transparent: true,
			opacity: 0.85
		});
		selectedTrailLine = new THREE.Line(geometry, material);
		scene.add(selectedTrailLine);
		return;
	}

	selectedTrailLine.geometry.setFromPoints(points);
	selectedTrailLine.geometry.computeBoundingSphere();
}

function seedAndRenderSelectedTrail() {
	if (!selectedPlaneKey) {
		clearSelectedTrailLine();
		return;
	}

	const selected = planeObjs.find(obj => obj.key === selectedPlaneKey);
	if (!selected || !selected.model) {
		clearSelectedTrailLine();
		return;
	}

	const currentPoint = selected.model.position.clone();
	currentPoint.y += 0.01;

	if (!trailPointsByKey.has(selectedPlaneKey)) {
		trailPointsByKey.set(selectedPlaneKey, [currentPoint]);
	}

	drawSelectedTrail(trailPointsByKey.get(selectedPlaneKey));
}

function sampleSelectedTrail(now) {
	if (!selectedPlaneKey) return;
	if (now - lastTrailSampleTime < TRAIL_SAMPLE_INTERVAL_MS) return;

	const selected = planeObjs.find(obj => obj.key === selectedPlaneKey);
	if (!selected || !selected.model) return;

	const currentPoint = selected.model.position.clone();
	currentPoint.y += 0.01;

	let points = trailPointsByKey.get(selectedPlaneKey);
	if (!points) {
		points = [];
		trailPointsByKey.set(selectedPlaneKey, points);
	}

	const lastPoint = points[points.length - 1];
	if (!lastPoint || lastPoint.distanceTo(currentPoint) >= TRAIL_MIN_DISTANCE) {
		points.push(currentPoint);
		if (points.length > TRAIL_MAX_POINTS) {
			points.splice(0, points.length - TRAIL_MAX_POINTS);
		}
		drawSelectedTrail(points);
	}

	lastTrailSampleTime = now;
}

function updateGroundMap(latitude, longitude) {
	const imageUrl = getStaticImageURL({lat: latitude, lng: longitude}, 9.8, {width: 512, height: 512});
	const Maploader = new THREE.TextureLoader();
	Maploader.setCrossOrigin('anonymous');
	Maploader.load(imageUrl, function(texture) {
		if (groundMesh) {
			scene.remove(groundMesh);
			if (groundMesh.geometry) groundMesh.geometry.dispose();
			if (groundMesh.material) {
				if (groundMesh.material.map) groundMesh.material.map.dispose();
				groundMesh.material.dispose();
			}
		}

		const groundGeometry = new THREE.PlaneGeometry(2, 2, 32, 32)
		groundGeometry.rotateX(Math.PI / 2)
		groundGeometry.rotateY(Math.PI / -2)
		groundGeometry.rotateZ(Math.PI / -1)
		const groundMaterial = new THREE.MeshBasicMaterial({map: texture, side: THREE.FrontSide } )
		groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
		scene.add(groundMesh);
	});
}

function applyLocation(latitude, longitude) {
	lat0 = latitude;
	long0 = longitude;
	sendLocationToServer(lat0, long0);
	updateGroundMap(lat0, long0);
	fetchPlanes();
}

function getUserLocation(callback) {
	if ("geolocation" in navigator) {
		navigator.geolocation.getCurrentPosition(position => {
			lat0 = position.coords.latitude;
			long0 = position.coords.longitude;
			//console.log(lat0, long0);
			sendLocationToServer(lat0, long0);
			updateGroundMap(lat0, long0);

			if (callback) {
				callback(lat0, long0);
			}
		}, error => {
			console.error("Error getting location", error);
		});
	} else {
		console.log("Geolocation not available");
	}
}

function getStaticImageURL(centerPoint, zoomLevel, mapSize) {
	const { lat, lng} = centerPoint;
	const { width, height} = mapSize;

	// osm-carto is the default OSM style
	return `https://maps.geoapify.com/v1/staticmap`
		+ `?style=osm-bright`
		+ `&width=${width}&height=${height}`
		+ `&center=lonlat:${lng},${lat}`
		+ `&zoom=${zoomLevel}`
		+ `&apiKey=${apiKey}`;
}

getUserLocation((lat0, long0) => {
	updateGroundMap(lat0, long0);
}); //initiate location request

if (applyTestLocationBtn) {
	applyTestLocationBtn.addEventListener('click', () => {
		const latitude = Number.parseFloat(testLatEl?.value ?? '');
		const longitude = Number.parseFloat(testLonEl?.value ?? '');
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			console.warn('Please enter a valid latitude and longitude.');
			return;
		}
		applyLocation(latitude, longitude);
	});
}

if (useCurrentLocationBtn) {
	useCurrentLocationBtn.addEventListener('click', () => {
		getUserLocation((latitude, longitude) => {
			if (testLatEl) testLatEl.value = latitude.toFixed(6);
			if (testLonEl) testLonEl.value = longitude.toFixed(6);
		});
	});
}



//loading in airplane model
const loader = new GLTFLoader();
loader.load('airplane.glb', function (glb) {
	console.log(glb)

	model = glb.scene;
	//model.position.set(0, 0, 0)
	model.scale.set(0.06,0.06,0.06)


	//scene.add(model)
}, undefined, function (error) {
	console.error(error);
});



function sendLocationToServer(latitude, longitude) {
    fetch(API_BASE_URL + '/api/location', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

//function to rotate model based on aircraft heading
function headingToRad(heading) {
	// heading is between 0 and 360, where 0 is pointing
	// +x is right
	// +y is up
	// +z is towards you
	heading = +heading;
	heading *= -1;
	if (!heading) {
		return 0;
	}
	return heading * Math.PI / 180;
}

//function to convert coordinates of an aircraft to coordinates in the 3d region
function convertCoordinates(planeLat, planeLong) {
	let x = (planeLong - long0) * KM_PER_DEGREE / SCALE_FACTOR
	let y = (planeLat - lat0) * KM_PER_DEGREE / SCALE_FACTOR

	return {x, y}
}

//creating models for each plane in range
var planeObjs = [] //new planes to be added
var planeData = [];
// interpolation time (ms) for smoothing movement between API updates
const INTERPOLATION_TIME = 2000; // 2 seconds by default - tune as desired

function addPlanes(planes, scene) {
	console.log("addPlanes number of records: " + planes.length)

	if (!model) {
		console.error("Model has not loaded yet")
		return;
	}

	// Build a lookup of incoming planes by callsign
	const incomingCalls = new Set();
	planeData = planes;
	planes.forEach(plane => {
		const planeKey = plane.id || plane.callsign || `${plane.latitude}:${plane.longitude}:${plane.heading || 0}`;
		if (planeKey) incomingCalls.add(planeKey);
	});

	// Update existing planes or create new ones
	planes.forEach(function(plane) {
		const callsign = plane.callsign || 'Unknown';
		const planeKey = plane.id || plane.callsign || `${plane.latitude}:${plane.longitude}:${plane.heading || 0}`;
		if (!planeKey || plane.latitude == null || plane.longitude == null) {
			return;
		}

		const latNum = Number(plane.latitude);
		const longNum = Number(plane.longitude);
		if (!Number.isFinite(latNum) || !Number.isFinite(longNum)) {
			return;
		}
		const altitudeValue = Number(plane.altitude);
		const altitudeCalc = Number.isFinite(altitudeValue) ? (altitudeValue / 45000) * 2 : 0;
		const coords = convertCoordinates(latNum, longNum);
		const endPos = new THREE.Vector3(coords.y, altitudeCalc, coords.x);

		// create quaternion from heading
		const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, headingToRad(plane.heading), 0));

		// try to find an existing plane object by callsign
		let existing = planeObjs.find(p => p.key === planeKey);

		if (existing) {
			// set up interpolation from current state to new target
			existing.startPos = existing.model.position.clone();
			existing.endPos = endPos;
			existing.startQuat = existing.model.quaternion.clone();
			existing.endQuat = endQuat;
			existing.startTime = performance.now();
			existing.duration = INTERPOLATION_TIME;
			existing.data = plane;

			// update label text (in case callsign or other info changed)
			if (existing.label && existing.label.element) existing.label.element.textContent = callsign;
		} else {
			// create new model and add to scene
			let planeP = document.createElement('p');
			let planeLabel = new CSS2DObject(planeP);
			planeP.textContent = callsign;
			planeP.style.color = 'red';

			const clone = model.clone();
			clone.userData.planeKey = planeKey;
			clone.traverse((node) => {
				node.userData.planeKey = planeKey;
			});
			clone.add(planeLabel);
			clone.position.copy(endPos);
			clone.quaternion.copy(endQuat);
			scene.add(clone);

			planeObjs.push({
				key: planeKey,
				callsign: callsign,
				data: plane,
				model: clone,
				label: planeLabel,
				// set identity so first frame is immediate
				startPos: clone.position.clone(),
				endPos: clone.position.clone(),
				startQuat: clone.quaternion.clone(),
				endQuat: clone.quaternion.clone(),
				startTime: performance.now(),
				duration: 0
			});
		}
	});

	// Remove planes that are no longer reported
	for (let i = planeObjs.length - 1; i >= 0; i--) {
		const obj = planeObjs[i];
		if (obj.key && !incomingCalls.has(obj.key)) {
			// remove from scene
			scene.remove(obj.model);
			if (obj.label) obj.label.removeFromParent();
			trailPointsByKey.delete(obj.key);
			if (selectedPlaneKey === obj.key) {
				selectedPlaneKey = null;
				setInfoPanel(null);
				clearSelectedTrailLine();
			}
			planeObjs.splice(i, 1);
		}
	}
}

//parsing JSON response into flight details
function processData(responseList) {
	if (!Array.isArray(responseList)) return [];
	return responseList;
}

//fetch nearby airplanes from Flask Backend
function fetchPlanes() {
	fetch(API_BASE_URL + '/response')
	.then(response => {
		if (!response.ok) {
			throw new Error('Network Response Wasn\'t ok ' + response.statusText );
		}
		return response.json();
	})
	.then(data => {
		const parsed = processData(data.response);
		addPlanes(parsed, scene)

		if (selectedPlaneKey) {
			const selected = planeObjs.find(obj => obj.key === selectedPlaneKey);
			if (selected) {
				setInfoPanel(selected.data);
			}
		}
	})
	.catch(error => console.error('Error fetching data from Flask', error));
}

fetchPlanes()
setInterval(fetchPlanes, 12000);


//resizing canvas to the size of the window
window.addEventListener( 'resize', () => {
	let width = window.innerWidth
	let height = window.innerHeight

	renderer.setSize( width, height )
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  	//update camera
	camera.aspect = width / height
	camera.updateProjectionMatrix()

	//update label size with window
	labelRenderer.setSize(width, height);
})

window.addEventListener('pointerdown', (event) => {
	if (!planeObjs.length) return;

	pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
	pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

	raycaster.setFromCamera(pointer, camera);
	const intersects = raycaster.intersectObjects(planeObjs.map(obj => obj.model), true);
	if (!intersects.length) return;

	let selectedObject = intersects[0].object;
	while (selectedObject && !selectedObject.userData.planeKey) {
		selectedObject = selectedObject.parent;
	}

	if (!selectedObject || !selectedObject.userData.planeKey) return;

	const clickedPlaneKey = selectedObject.userData.planeKey;
	if (selectedPlaneKey === clickedPlaneKey) {
		selectedPlaneKey = null;
		setInfoPanel(null);
		clearSelectedTrailLine();
		return;
	}

	selectedPlaneKey = clickedPlaneKey;
	lastTrailSampleTime = 0;
	const selected = planeObjs.find(obj => obj.key === selectedPlaneKey);
	if (selected) {
		setInfoPanel(selected.data);
		seedAndRenderSelectedTrail();
	}
});

const loop = () => {
	// interpolate plane positions and rotations
	const now = performance.now();
	planeObjs.forEach(obj => {
		if (!obj.model) return;

		const t0 = obj.startTime || now;
		const dur = obj.duration || 0;
		let alpha = dur > 0 ? Math.min((now - t0) / dur, 1) : 1;

		// optional easing (smoothstep)
		alpha = alpha * alpha * (3 - 2 * alpha);

		// position lerp
		if (obj.startPos && obj.endPos) {
			obj.model.position.lerpVectors(obj.startPos, obj.endPos, alpha);
		}

		// rotation slerp
		if (obj.startQuat && obj.endQuat) {
			obj.model.quaternion.copy(obj.startQuat).slerp(obj.endQuat, alpha);
		}
	});

	sampleSelectedTrail(now);

	labelRenderer.render(scene, camera)
	renderer.render(scene, camera)

	window.requestAnimationFrame(loop)
}
loop()
