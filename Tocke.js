mapboxgl.accessToken = 'pk.eyJ1IjoidXJiYW4tYSIsImEiOiJjam5uZjE4MTAwaHpkM3FubnEzZDB4aHNyIn0.D1UhaVqcQeSRKmCZzUwa_w';
if (!('remove' in Element.prototype)) {
  Element.prototype.remove = function() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  };
}

var poljeTock = [];
var carLocation;
var startingLocation;
var lastAtRestaurant = 0;
var iMax=4;
var keepTrack = [];
var currentRoute = null;
var pointHopper = {};
var dropoffs = turf.featureCollection([]);
var nothing = turf.featureCollection([]);
var opcije = { units: 'kilometers' };

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v9',
  center: [14.505548,46.056487],
  zoom: 11.5
});

var geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  country: 'si'
});


restavracije.features.forEach(function(marker) {
  //window.alert(marker.properties.distance);
  var element = document.createElement('div');
  switch (marker.properties.tip) {
    case "Pizzerija":
      element.className = 'RMarkerP';
      break;
    case "Gostilna":
      element.className = 'RMarkerG';
      break;
    case "Restavracija":
      element.className = 'RMarkerR';
      break;
    case "Jezero":
      element.className = 'LMarkerJ';
      break;
    case "Grad":
      element.className = 'LMarkerG';
      break;
    case "Mesto":
      element.className = 'LMarkerM';
      break;
    default:
    element.className = 'RMarker';

  }

  poljeTock.push(element);
  new mapboxgl.Marker(element, { offset: [0, -23] })
    .setLngLat(marker.geometry.coordinates)
    .addTo(map);
  element.addEventListener('click', function(e) {
    var aktivni = document.getElementsByClassName('active');
    ustvariPopUp(marker);
    e.stopPropagation();
    if (aktivni[0]) {
      aktivni[0].classList.remove('active');
    }
  });
})


function newDropoff(coords) {
  // Store the clicked point as a new GeoJSON feature with
  // two properties: `orderTime` and `key`
  var tocka = turf.point(
    [coords.lng, coords.lat], {
      orderTime: Date.now(),
      key: Math.random()
    }
  );
  dropoffs.features.push(tocka);
  pointHopper[tocka.properties.key] = tocka;

  // Make a request to the Optimization API
  $.ajax({
    method: 'GET',
    url: assembleQueryURL(),
  }).done(function(data) {
    // Create a GeoJSON feature collection
    var routeGeoJSON = turf.featureCollection([turf.feature(data.trips[0].geometry)]);

    // If there is no route provided, reset
    if (!data.trips[0]) {
      routeGeoJSON = nothing;
    } else {
      // Update the `route` source by getting the route source
      // and setting the data equal to routeGeoJSON
      map.getSource('route')
        .setData(routeGeoJSON);
    }

    var koordinatePoti=routeGeoJSON.features[0].geometry;
    poljeTock.forEach(function(e){
      e.classList.add("Hidden");
    });

    restavracije.features.forEach(function(restavracija, index) {
      var prejsnja=0, razlika=1, razdalja=0, maxRazdalja=0.0002;
      maxRazdalja+=0.0002*Math.floor(koordinatePoti.coordinates.length/1000);
      //console.log(maxRazdalja);
      var skip=0;
      koordinatePoti.coordinates.forEach(function(e, index1){
        if(!skip){
          if(razlika==0)
          {
            razlika=Math.abs((e[0]+e[1])-prejsnja);
          }
          if(razlika>maxRazdalja)
          {
            razdalja=turf.distance(e, restavracija.geometry, opcije);
            if(restavracija.properties.distance)
            {
              if(razdalja<restavracija.properties.distance)
              {
                //console.log(index+ " " + restavracija.properties.distance + " km --> " + razdalja + " km");
                restavracija.properties.distance=razdalja;
              }else if(restavracija.properties.distance<iMax && razdalja>iMax*2)
              {
                //console.log("koncujem "+ razdalja);
                skip=1;
                //break;
              }
            }else{
              Object.defineProperty(restavracija.properties, 'distance', {
              value: turf.distance(e, restavracija.geometry, opcije),
              writable: true,
              enumerable: true,
              configurable: true
              });
            }
            if(restavracija.properties.distance<iMax)
            {
              //console.log(index+ " " + restavracija.properties.distance + " metrov");
              poljeTock[index].style.visibility="visible";
              poljeTock[index].classList.remove("Hidden");
            }
            //console.log(index+ " " + turf.distance(e, eprej, opcije)*1000+ " metrov");
            razlika=0;
            //eprej=e;
            //if(restavracija.properties.distance)
          }else {
            razlika+=Math.abs((e[0]+e[1])-prejsnja);
            //console.log(index1+" premalo " + razdalja);
          }
          prejsnja=e[0]+e[1];
          //console.log(JSON.stringify(e));
        }
      });
    });

    if (data.waypoints.length === 12) {
      window.alert('Maximum number of points reached.');
    }
  });
}

function updateDropoffs(geojson) {
  map.getSource('dropoffs-symbol')
    .setData(geojson);
}


function assembleQueryURL() {
  // Store the location of the truck in a variable called coordinates
  var coordinates = [carLocation];
  var distributions = [];
  keepTrack = [carLocation];

  // Create an array of GeoJSON feature collections for each point
  var restJobs = objectToArray(pointHopper);

  // If there are actually orders from this restaurant
  if (restJobs.length > 0) {


    restJobs.forEach(function(d, i) {
      // Add dropoff to list
      keepTrack.push(d);
      coordinates.push(d.geometry.coordinates);

    });
  }

  // Set the profile to `driving`
  // Coordinates will include the current location of the truck,
  return 'https://api.mapbox.com/optimized-trips/v1/mapbox/driving/' + coordinates.join(';')  + '?steps=true&geometries=geojson&access_token=' + mapboxgl.accessToken;
}

function objectToArray(obj) {
  var keys = Object.keys(obj);
  var routeGeoJSON = keys.map(function(key) {
    return obj[key];
  });
  return routeGeoJSON;
}

function SkrijPrikazi()
{
  var polje=document.getElementsByClassName("Hidden");
  for (i = 0; i < polje.length; i++)
  {
    if(polje[i].style.visibility=="hidden")
    {
      polje[i].style.visibility="visible";
    }else{
      polje[i].style.visibility="hidden";
    }
  }
}

map.on('load', function(e) {
  map.addSource('places', {
    type: 'geojson',
    data: restavracije
  });

  map.addControl(geocoder);
/*  var markerT = document.createElement('div');
  markerT.classList = 'startingPoint';

  // Create a new marker
  truckMarker = new mapboxgl.Marker(markerT)
    .setLngLat(carLocation)
    .addTo(map); */
    geocoder.on('result', function(ev) {
      var key="distance";
      restavracije.features.forEach(function(feat){
        delete feat.properties[key];
      });
      //console.log(JSON.stringify(restavracije.features));

      dropoffs = turf.featureCollection([]); //izbriše markerje
      //coordinates = []; //ne pomaga
      pointHopper = [];


      map.getSource('single-point').setData(ev.result.geometry);
      startingLocation=ev.result.geometry.coordinates;
      carLocation=ev.result.geometry.coordinates;






    });

    map.addSource('single-point', {
      "type": "geojson",
      "data": {
        "type": "FeatureCollection",
        "features": []
      }
    });

    map.addLayer({
      id: "warehouse",
      source: "single-point",
      type: "circle",
      paint: {
        'circle-radius': 20,
        'circle-color': 'white',
        'circle-stroke-color': '#3887be',
        'circle-stroke-width': 3
      }

    });





    map.addLayer({
      id: 'dropoffs-symbol',
      type: 'symbol',
      source: {
        data: dropoffs,
        type: 'geojson'
      },
      layout: {
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-image': 'marker-15',
      }
    });


    // Čaka na klik na zemljevid
    map.on('click', function(e) {
      // Ob kliku na zemljevid doda novo drop-off točko
      // in osveži `dropoffs-symbol` layer
      if(startingLocation == null){

        map.getSource('single-point').setData(e.target);
        startingLocation=e.lngLat;
        carLocation=e.lngLat;
        alert("Poišči preko search");
      }
      //else{
        newDropoff(map.unproject(e.point));
        updateDropoffs(dropoffs);
      //}

    });

    map.addSource('route', {
      type: 'geojson',
      data: nothing
    });

    map.addLayer({
      id: 'routeline-active',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3887be',
        'line-width': {
          base: 1,
          stops: [
            [12, 3],
            [22, 12]
          ]
        }
      }
    }, 'waterway-label');

    map.addLayer({
      id: 'routearrows',
      type: 'symbol',
      source: 'route',
      layout: {
        'symbol-placement': 'line',
        'text-field': '▶',
        'text-size': {
          base: 1,
          stops: [[12, 24], [22, 60]]
        },
        'symbol-spacing': {
          base: 1,
          stops: [[12, 30], [22, 160]]
        },
        'text-keep-upright': false
      },
      paint: {
        'text-color': '#3887be',
        'text-halo-color': 'hsl(55, 11%, 96%)',
        'text-halo-width': 3
      }
    }, 'waterway-label');

    document.getElementById("GumbSkrij").onclick=SkrijPrikazi;


});


// Čaka na klik na zemljevid
function dodajTocko(lng, lat){
  // Ob kliku na zemljevid doda novo drop-off točko
  // in osveži `dropoffs-symbol` layer
  var coords = {
    "lng": lng,
    "lat": lat
  };

  newDropoff(coords);
  updateDropoffs(dropoffs);

}


var zacasna;
function ustvariPopUp(trenutna) {
  var popUps = document.getElementsByClassName('mapboxgl-popup');
  if (popUps[0])
  {
    popUps[0].remove();
  }
  var stringHTML='<h3>'+trenutna.properties.naziv+'</h3>' +
    '<p> <b>' + trenutna.properties.tip + '</b> <br/>';
  if(trenutna.properties.naslov)
  {
    stringHTML+=trenutna.properties.naslov + '<br/>'
  }
  if(trenutna.properties.odpre&&trenutna.properties.zapre)
  {
    stringHTML+='Odprto: ' + trenutna.properties.odpre + ' - ' + trenutna.properties.zapre + '<br/>'
  }
  if (trenutna.properties.dodatno)
  {
    stringHTML+='<b><a href='+trenutna.properties.dodatno+' target=_blank>Več informacij</a></b><br/>'
  }
  if (trenutna.properties.distance)
  {
    stringHTML+='Razdalja: ' + parseFloat(trenutna.properties.distance.toFixed(3))  + ' km </p>'
  }
  zacasna=
  stringHTML+='<button type="button" class="dodaj" onClick="dodajTocko('+trenutna.geometry.coordinates[0]+","+trenutna.geometry.coordinates[1]+')" >Dodaj</button>';
  //stringHTML+='<button type="button" class="dodaj" onClick="window.alert('+trenutna.geometry.coordinates+')" >Dodaj</button>';
  var popup = new mapboxgl.Popup({ closeOnClick: true })
  .setLngLat(trenutna.geometry.coordinates)
  .setHTML(stringHTML)
  .addTo(map);


}
