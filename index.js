var express = require('express');
var app = express();
var _ = require('underscore');

app.use(app.router);

interval = 10; // seconds
maxReadings = (60 / interval) * 60 * 24;

readings = [];

function addReading(temp, compressor){
  if (readings.length >= maxReadings) {
    readings.shift();
  }
  readings.push([temp, compressor]);
};

app.get('/', function(req, res){
  reading = _.last(readings);
  if(reading){
    reading = reading[0].toString() + "° F";
  } else {
    reading = "Offline!";
  }
  res.send("<!doctype html><html lang=en><head><meta charset=utf-8><title>Beer!</title><script>var readings = "+JSON.stringify(readings)+"</script></head><body><p>Temperature is "+reading+"</p></body></html>");
});

app.post('/reading', function(req, res){
  console.log(req.body);
  res.send('OK', 200);
});

app.use(logErrors);

var server = app.listen(process.env.PORT || 3000, function() {
    console.log('Listening on port %d', server.address().port);
});

function logErrors(err, req, res, next) {
  console.error(err.stack);
  next(err);
}
