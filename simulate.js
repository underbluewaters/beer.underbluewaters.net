// Simulates sensor posting to the server
// PORT=3000 HOST=localhost RATE=3000 node simulate.js

var request = require('request');

var PORT = process.env.PORT || 3000,
    HOST = process.env.HOST || 'localhost',
    RATE = process.env.RATE || 3000
    SETPOINT = 36,
    DELTA = 0.2;

var temperature = SETPOINT,
    compressor = 0;

function stepTemperature(){
  if (compressor === 1) {
    temperature -= DELTA;
  } else {
    temperature += (DELTA * .5);
  }
}

function stepThermostat() {
  if (temperature < (SETPOINT)) {
    compressor = 0;
  } else {
    compressor = 1;
  }
}

function postState() {
  // console.log('posting', temperature, compressor);
  request.post({
    headers: {'content-type' : 'text/csv'},
    auth: {
      user: 'cburt',
      pass: '7lobster',
      sendImmediately: true
    },
    url: 'http://' + HOST + ':' + PORT + '/reading',
    body: 'temperature,'+(Math.round(temperature * 100) / 100)+'\ncompressor,'+compressor,
  }, function(error, response, body) {
    if (error) {
      console.log(error);
    }
  });
}

setInterval(stepTemperature, RATE / 3);
setInterval(stepThermostat, RATE * 4);
setInterval(postState, RATE);
