import * as THREE from 'three'
import './style.css'
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {CSS2DRenderer, CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls"

//scene
const scene = new THREE.Scene()
//plane model
let model = null;
//user longitude and latitude
let lat0 = 36.12063617887522
let long0 = -86.6819769217225

//constants for distance conversion
const EARTH_CIRCUMFERENCE_KM = 40075.0;
const DEGREES = 360.0;
const KM_PER_DEGREE =  EARTH_CIRCUMFERENCE_KM / DEGREES;

// assuming that each unit in the plane represents 10 km
const SCALE_FACTOR = 20;

//creating a wire box
//2 x 2 x 2 wire mesh box
var geometry = new THREE.BoxGeometry( 2, 2, 2)
var material = new THREE.MeshNormalMaterial( {wireframe: true, transparent: true
})
var mesh = new THREE.Mesh ( geometry, material )
mesh.position.y += 1;
var helper = new THREE.BoxHelper( mesh )
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
camera.position.set(4, 6, 6);
// Make the camera look at the object
camera.lookAt(helper.position);
scene.add( camera )

// renderer
const canvas = document.querySelector('.webgl')
const renderer = new THREE.WebGLRenderer({canvas})
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.render( scene, camera )

//labelRenderer creation
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.pointerEvents = 'none'; //preventing container from capturing mouse events
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.color = "white"
labelRenderer.domElement.style.fontSize = "small"
document.body.appendChild(labelRenderer.domElement);

//controls
const controls = new OrbitControls(camera, canvas)
controls.enablePan = false //region always centered
//controls.enableZoom = false //no scroll to zoom

function getUserLocation(callback) {
	if ("geolocation" in navigator) {
		navigator.geolocation.getCurrentPosition(position => {
			lat0 = position.coords.latitude;
			long0 = position.coords.longitude;
			//console.log(lat0, long0);
			sendLocationToServer(lat0, long0);

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

function getStaticImageURL(apiKey, centerPoint, zoomLevel, mapSize) {
	const baseUrl = "https://dev.virtualearth.net/REST/v1/Imagery/Map/Road";
	const center = `${centerPoint.lat},${centerPoint.lng}`;
	const size = `${mapSize.width},${mapSize.height}`;
	const zoom = zoomLevel;

	return `${baseUrl}/${center}/${zoom}?mapSize=${size}&key=${apiKey}`;
}

const apiKey = 'AstsRYOK9ExBIF1kaNV6e76MOVV-GjexUYU3KwdSDOhZDRyhx3uj-D-HRxvO6gqp';
// const imageUrl = getStaticImageURL(apiKey, { lat: lat0, lng: long0}, 10, { width: 512, height: 512 });
getUserLocation((lat0, long0) => {
	const imageUrl = getStaticImageURL(apiKey, {lat: lat0, lng: long0}, 11, {width: 512, height: 512})

	//creating ground flat object
	// 2 x 2 area
	const Maploader = new THREE.TextureLoader();
	Maploader.load(imageUrl, function(texture) {
		const groundGeometry = new THREE.PlaneGeometry(2, 2, 32, 32)
		groundGeometry.rotateX(Math.PI / 2) //rotating plane 90 deg
		groundGeometry.rotateY(Math.PI / -2)
		groundGeometry.rotateZ(Math.PI / -1)
		const groundMaterial = new THREE.MeshBasicMaterial({map: texture, side: THREE.FrontSide } )
		const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
		//can lower it down - but I chose to raise the cube up by 1
		scene.add(groundMesh);

	});
}); //initiate location request



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
    fetch('http://127.0.0.1:5000/api/location', {
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
function addPlanes(planes, scene) {
	console.log("addPlanes number of records: " + planes.length)


	planeObjs.forEach(function(obj) {
		scene.remove(obj.model) //remove old plane models before adding new updated locations
		obj.label.removeFromParent()
	})

	planeObjs = [];
	if (!model) {
		console.error("Model has not loaded yet")
		return;
	}

	planes.forEach(function(plane) {
		let planeP = document.createElement('p');
		let planeLabel = new CSS2DObject(planeP);
		planeP.textContent = plane.callsign;
		
		const clone = model.clone();
		clone.add(planeLabel);
		var altitudeCalc = (Number(plane.altitude) / 45000) * 2;

		var coordinates = convertCoordinates(plane.latitude, plane.longitude)
		clone.position.set(coordinates.y, altitudeCalc, coordinates.x)
		//console.log(coordinates)
		clone.rotation.y = headingToRad(plane.heading)
		
		scene.add(clone);
		// planeObjs.push(clone);
		planeObjs.push({model: clone, label: planeLabel})
	});
	
}

//parsing JSON response into flight details
function processData(responseList) {
	const flightData = responseList.map(entry => {
		const parts = entry.split(' ');

		// Extracting latitude and longitude
		// const latLongIndex = parts.findIndex(part => part === '(lat/long):') + 1;
		// const [latitude, longitude] = parts[latLongIndex].split(' ');
		const latLongRegex = /\(lat\/long\):\s*([-\d.]+)\s+([-\d.]+)/;
        const latLongMatch = entry.match(latLongRegex);

        let latitude, longitude;
        if (latLongMatch) {
            latitude = latLongMatch[1];
            longitude = latLongMatch[2];
        }

		// Extracting altitude
		const altitudeIndex = parts.findIndex(part => part === 'Altitude:') + 1;
		const altitude = parts[altitudeIndex];

		// Extracting heading
		const headingIndex = parts.findIndex(part => part === 'Heading:') + 1;
		const heading = parts[headingIndex];

		// Extracting callsign
		const callsignIndex = parts.findIndex(part => part === 'Callsign:') + 1;
		const callsign = parts[callsignIndex];

		// Extracting aircraft type
		const typeIndex = parts.findIndex(part => part === 'Aircraft Type: ') + 1;
		const type = parts[typeIndex];

		return { latitude, longitude, altitude, heading, callsign, type };
	});

	console.log(flightData) //array of objects with lat, long, altitude, heading
	return flightData
}

//fetch nearby airplanes from Flask Backend
function fetchPlanes() {
	fetch('http://127.0.0.1:5000/response')
	.then(response => {
		if (!response.ok) {
			throw new Error('Network Response Wasn\'t ok ' + response.statusText );
		}
		return response.json();
	})
	.then(data => {
		planeData = processData(data.response);
		addPlanes(planeData, scene)
	})
	.catch(error => console.error('Error fetching data from Flask', error));
}

fetchPlanes()
setInterval(fetchPlanes, 15000);


//resizing canvas to the size of the window
window.addEventListener( 'resize', () => {
	let width = window.innerWidth
	let height = window.innerHeight

	renderer.setSize( width, height )

  	//update camera
	camera.aspect = width / height
	camera.updateProjectionMatrix()

	//update label size with window
	labelRenderer.setSize(width, height);
})

const loop = () => {
  labelRenderer.render(scene, camera)
  renderer.render(scene, camera)

  window.requestAnimationFrame(loop)
}
loop()
