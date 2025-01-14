// Initialize the map and center it on Hafar Al-Batin, Saudi Arabia
var map = L.map('map').setView([28.4342, 45.9636], 10); // Center on Hafar Al-Batin
console.log('Map initialized:', map); // Log the map object

// Add Esri World Imagery as the background layer
var baseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri'
}).addTo(map);
console.log('Base layer added:', baseLayer); // Log the base layer

// Define UTM Zone 39N and WGS84 projections
proj4.defs('EPSG:32639', '+proj=utm +zone=39 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');

// Function to reproject coordinates from UTM Zone 39N to WGS84
function reprojectCoordinates(coordinates) {
  return coordinates.map(coord => {
    return proj4('EPSG:32639', 'EPSG:4326', coord);
  });
}

// Function to reproject GeoJSON features
function reprojectGeoJSON(geojson) {
  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates = feature.geometry.coordinates.map(polygon => {
        return polygon.map(ring => {
          return reprojectCoordinates(ring);
        });
      });
    }
  });
  return geojson;
}

// Load TPA GeoJSON data
fetch('data/tpas.geojson') // Ensure the path to your GeoJSON file is correct
  .then(response => response.json())
  .then(data => {
    console.log('Original GeoJSON Data:', data); // Log the original data

    // Reproject the GeoJSON coordinates
    var reprojectedData = reprojectGeoJSON(data);
    console.log('Reprojected GeoJSON Data:', reprojectedData); // Log the reprojected data

    // Add TPA layer to the map with reduced fill opacity
    var tpaLayer = L.geoJSON(reprojectedData, {
      style: { color: 'blue', weight: 2, fillOpacity: 0.05 }, // Reduce fill opacity further
      onEachFeature: function (feature, layer) {
        layer.bindPopup(`TPA ID: ${feature.properties.TPA_Code}`); // Show TPA ID in popup
        layer.on('click', function () {
          showWeightForm(feature.properties.TPA_Code);
        });
      }
    }).addTo(map);
    console.log('TPA layer added:', tpaLayer); // Log the TPA layer

    // Zoom the map to the TPA layer bounds
    map.fitBounds(tpaLayer.getBounds());
    console.log('Map zoomed to TPA bounds:', tpaLayer.getBounds()); // Log the bounds
  })
  .catch(error => {
    console.error('Error loading TPA GeoJSON:', error);
  });

// Function to show the weight form for a specific TPA
function showWeightForm(tpaId) {
  document.getElementById('tpa-id').textContent = tpaId;
  document.getElementById('weight-form').style.display = 'block';
}

// Function to save weights for the selected TPA
function saveWeights() {
  var tpaId = document.getElementById('tpa-id').textContent;
  var weights = getWeights();
  console.log(`Weights for TPA ${tpaId}:`, weights);
  alert(`Weights for TPA ${tpaId} saved!`);
}

// Function to get weights
function getWeights() {
  var weights = {};
  document.querySelectorAll('.weight').forEach(input => {
    weights[input.name] = input.value;
  });
  return weights;
}

// Enable drawing tools
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems // Allow editing of drawn features
  },
  draw: {
    polygon: {
      allowIntersection: false, // Prevent self-intersecting polygons
      drawError: {
        color: '#ff0000', // Color for invalid polygons
        message: '<strong>Error:</strong> Polygon edges cannot cross!'
      },
      shapeOptions: {
        color: '#ff0000', // Color for valid polygons
        fillOpacity: 0.2
      }
    },
    rectangle: {
      shapeOptions: {
        color: '#ff0000', // Color for rectangles
        fillOpacity: 0.2
      }
    },
    polyline: false, // Disable polyline drawing
    circle: false, // Disable circle drawing
    marker: false, // Disable marker drawing
    circlemarker: false // Disable circle marker drawing
  }
});

// Add custom control for drawing tools
var customDrawControl = L.control({ position: 'topright' });

customDrawControl.onAdd = function () {
  var div = L.DomUtil.create('div', 'custom-draw-control');
  div.innerHTML = `
    <button onclick="enableDrawing('rectangle')">Draw Rectangle</button>
    <button onclick="enableDrawing('polygon')">Draw Polygon</button>
    <button onclick="map.zoomIn()">Zoom In</button>
    <button onclick="map.zoomOut()">Zoom Out</button>
    <button onclick="enableEditing()">Edit Layers</button>
    <button onclick="enableDeleting()">Delete Layers</button>
  `;
  return div;
};

customDrawControl.addTo(map);

// Function to enable drawing
function enableDrawing(type) {
  if (type === 'rectangle') {
    new L.Draw.Rectangle(map, drawControl.options.rectangle).enable();
  } else if (type === 'polygon') {
    new L.Draw.Polygon(map, drawControl.options.polygon).enable();
  }
}

// Function to enable editing
function enableEditing() {
  new L.EditToolbar.Edit(map, {
    featureGroup: drawnItems
  }).enable();
}

// Function to enable deleting
function enableDeleting() {
  new L.EditToolbar.Delete(map, {
    featureGroup: drawnItems
  }).enable();
}

// Track expert name and specialty
var expertName = '';
var expertSpecialty = '';

// Function to start drawing
function startDrawing() {
  expertName = document.getElementById('expert-name').value;
  expertSpecialty = document.getElementById('expert-specialty').value;
  var weights = getWeights();

  if (!expertName || !expertSpecialty || Object.values(weights).some(weight => !weight)) {
    alert('Please enter your name, select your specialty, and assign weights to all criteria.');
    return;
  }
  alert('You can now start drawing.');
}

// Listen for draw events
map.on(L.Draw.Event.CREATED, function (event) {
  var layer = event.layer;
  layer.feature = layer.feature || {}; // Initialize feature if it doesn't exist
  layer.feature.properties = layer.feature.properties || {}; // Initialize properties
  layer.feature.properties.expertName = expertName; // Add expert name to properties
  layer.feature.properties.expertSpecialty = expertSpecialty; // Add expert specialty to properties
  layer.feature.properties.weights = getWeights(); // Add weights to properties
  drawnItems.addLayer(layer);
  console.log(layer.toGeoJSON()); // Log the GeoJSON data
});

// Export function
function exportData() {
  var expertName = document.getElementById('expert-name').value.trim();
  var expertSpecialty = document.getElementById('expert-specialty').value.trim();

  if (!expertName || !expertSpecialty) {
    alert('Please enter your name and select your specialty.');
    return;
  }

  var data = drawnItems.toGeoJSON(); // Convert drawn features to GeoJSON
  var dataStr = JSON.stringify(data);
  var blob = new Blob([dataStr], { type: 'application/json' });
  var url = URL.createObjectURL(blob);

  // Create a download link with the naming convention: expertname_specialty.geojson
  var link = document.createElement('a');
  link.href = url;
  link.download = `${expertName}_${expertSpecialty}.geojson`;
  link.click();
}

// Load and display GeoJSON
function loadGeoJSON() {
  var fileInput = document.getElementById('geojson-file');
  var file = fileInput.files[0];
  if (!file) {
    alert('Please select a GeoJSON file.');
    return;
  }

  var reader = new FileReader();
  reader.onload = function (e) {
    var geojson = JSON.parse(e.target.result);
    L.geoJSON(geojson, {
      style: { color: 'red', weight: 2, fillOpacity: 0.1 },
      onEachFeature: function (feature, layer) {
        layer.bindPopup(`Expert: ${feature.properties.expertName}<br>Specialty: ${feature.properties.expertSpecialty}`);
      }
    }).addTo(map);
  };
  reader.readAsText(file);
}

// Add a Finish button at the bottom-left corner (after rank criteria and before load expert input tab)
var finishButton = L.control({ position: 'bottomleft' });

finishButton.onAdd = function () {
  var div = L.DomUtil.create('div', 'finish-button');
  div.innerHTML = '<button onclick="exportData()">Finish</button>';
  return div;
};

finishButton.addTo(map);

// Add company logo to the top-right corner
var logoControl = L.control({ position: 'topright' });

logoControl.onAdd = function () {
  var div = L.DomUtil.create('div', 'logo-control');
  div.innerHTML = '<img src="download.jpeg" alt="Company Logo" style="width: 100px; height: auto;">';
  return div;
};

logoControl.addTo(map);

// Function to open tabs
function openTab(tabName) {
  var tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => tab.style.display = 'none');
  document.getElementById(tabName).style.display = 'block';
}

// Open the Soil tab by default
openTab('soil');