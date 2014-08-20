// Runs on the Arduino Yun's Linono cpu

var SerialPort = require("serialport").SerialPort,
    request = require('request-json'),
    _ = require('underscore'),
    client = request.newClient(process.env.BEER_HOST || 'http://10.0.1.14:3001')
    relayState = new Buffer([0x00]),
    setpoints = {fermenter: 69, keezer: 38, holdover: 1.0, lagFactor: 0.5},
    FERMENTER = process.env.FERMENTER_INDEX || 0,
    KEEZER = FERMENTER ^ 1,
    initializing = true,
    password = process.env.BEER_PASSWORD || 'password',
    username = process.env.BEER_USER || 'beer',
    port = process.env.ARDUINO_PORT || "/dev/ttyATH0",
    serialPort = new SerialPort(port, {
      baudrate: 115200,
    }, false);

console.log(process.env.BEER_USER, process.env.BEER_PASSWORD, process.env.BEER_HOST)
client.setBasicAuth(username, password);

function updateRelay(prevState, data) {
  var newState = 0x00;
  f_thresh_low = setpoints.fermenter -
    (setpoints.holdover * setpoints.lagFactor)
  f_thresh_high = setpoints.fermenter + setpoints.holdover
  k_thresh_low = setpoints.keezer - (setpoints.holdover * setpoints.lagFactor)
  k_thresh_high = setpoints.keezer + setpoints.holdover
  if (FERMENTER === 0 || data.length > 1) {
    // update fermenter relay
    if (data[FERMENTER] < f_thresh_low) {
      // turn off compressor
      newState = newState | 0x00;
    } else if (data[FERMENTER] > f_thresh_high) {
      // turn on compressor
      newState = newState | 0x01;
    } else if (prevState[0] & 0x01 && data[FERMENTER] >= f_thresh_low) {
      newState = newState | 0x01;
    }
  }
  if (KEEZER === 0 || data.length > 1) {
    // update keezer relay
    if (data[KEEZER] < k_thresh_low) {
      // turn off compressor
      newState = newState | 0x00;
    } else if (data[KEEZER] > k_thresh_high) {
      newState = newState | 0x10;
    } else if (prevState[0] & 0x10 && data[KEEZER] >= k_thresh_low) {
      newState = newState | 0x10;
    }
  }
  return new Buffer([newState]);
}

function handlePacket(data){
  console.log('handlePacket', data);
  if (!initializing) {
    relayState = updateRelay(relayState, data);
    console.log('sending command to arduino', 'c', relayState);
    serialPort.write('c');
    serialPort.write(relayState);
  }
  packet = {
    fermenter: {
      temperature: data[FERMENTER],
      compressor: !!(0x01 & relayState[0])
    },
    keezer: {
      temperature: data[KEEZER],
      compressor: !!(0x10 & relayState[0])
    }
  }
  client.post('/', packet, {timeout: 800}, function(err, res, body){
    if (err) {
      console.log('error', err.message);
    } else {
      initializing = false
      if (body) {
        setpoints = _.extend(setpoints, body)
      }
    }
  });
}

serialPort.on("open", function () {
  console.log('serial port open');
  var packet = "";
  serialPort.on('data', function(data) {
    console.log('data', data.toString());
    if (packet.length === 0 && data.toString()[0] !== "[") {
      // skip, comms are offset. Wait until later reading
      console.log('comms offset, skipping packet', data.toString());
    } else {
      packet = packet + data.toString();
      if (packet.indexOf('\n') != -1) {
        try {
          var json = JSON.parse(packet);
          handlePacket(json);
        } catch(e) {
          console.log('Error processing JSON from Arduino', e.message);
        }
        packet = "";
      }
    }
  });
});

serialPort.on('error', function(err) {
    console.log('error: '+err);
});

serialPort.open();
