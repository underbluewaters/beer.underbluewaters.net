"use strict";

var express = require('express'),
    _ = require('underscore'),
    bodyParser = require('body-parser'),
    auth = require('http-auth'),
    highland = require('highland'),
    average = require('./lib/average'),
    store = require('./lib/store'),
    username = process.env.USERNAME || "beer",
    password = process.env.PASSWORD || "password",
    setpoints = {
      keezer: process.env.KEEZER_SETPOINT || 35,
      fermenter: process.env.FERMENTER_SETPOINT || 67,
      holdover: process.env.HOLDOVER || 1.0,
      lagFactor: process.env.LAG_FACTOR || 0.5
    },
    MongoClient = require('mongodb').MongoClient,
    app = express();

var basic = auth.basic({ realm: "beer.underbluewaters.net" },
  function (u, p, next) { next(u === username && p === password); });

app.use(bodyParser.text({type: 'text/*'}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));

// Setup hogan-based mustache templates
app.set('views', __dirname + '/views');
app.set('view engine', 'mustache');
app.engine('mustache', require('hogan-express'));

// all sensor readings will be pushed to a stream
// for further processing
var readings = highland();

// Keep track of latest readings for rending index.html
var latest = {fermenter: {}, keezer: {}};
readings.observe().each(function(reading){
  latest = reading;
  latest.fermenter.temperature = Math.round(latest.fermenter.temperature * 10) / 10;
  latest.keezer.temperature = Math.round(latest.keezer.temperature * 10) / 10;
  latest.timestamp = Date.now()
});

// var rtStream = readings.fork();
//
setInterval(function(){
  if(Date.now() - latest.timestamp > 30000) {
    latest = {fermenter: {}, keezer: {}};
    readings.write(latest);
  }
}, 30000)
//
// Mostly we're worried about temperature data
var fermenterTemperatureStream = readings.fork().map(function(d){
  return Math.round(d.fermenter.temperature * 10) / 10;
}).compact()

var keezerTemperatureStream = readings.fork().map(function(d){
  return Math.round(d.keezer.temperature * 10) / 10;
}).compact()

var noDataErrorHandler = function(err, push){
  var message = err.message;
  if (/No samples/.test(err.message)) {
    console.log(err.message);
  } else {
    push(err);
  }
};

// Setup various averages to be recorded
['10s', '3m'].forEach(function(duration){

  var collection1 = store.collection('fermenter' + duration);
  average(duration, fermenterTemperatureStream.fork())
    .errors(noDataErrorHandler).each(function(doc){
      collection1.write(doc);
    });

  var collection2 = store.collection('keezer' + duration);
  average(duration, keezerTemperatureStream.fork())
    .errors(noDataErrorHandler).each(function(doc){
      collection2.write(doc);
    });

});

app.post('/', auth.connect(basic), function(req, res){
  if(req.body && req.body.fermenter){
    readings.write(req.body);
  }
  res.send(JSON.stringify(setpoints), 200);
});

app.get('/', function(req, res){
  res.render('index', {
    setpoints: setpoints,
    ferTemp: latest.fermenter.temperature,
    ferCompressor: latest.fermenter.compressor,
    keezTemp: latest.keezer.temperature,
    keezCompressor: latest.keezer.compressor
  });
});

app.get('/setpoints', function(req, res){
  res.render('setpoints', {
    setpoints: setpoints
  });
});

app.post('/setpoints', auth.connect(basic), function(req, res){
  if (req.body && req.body.fermenter > 0 && req.body.keezer > 0) {
    setpoints = _.extend(setpoints, req.body);
    _.keys(setpoints).forEach(function(key){
      if (key !== '_id') {
        setpoints[key] = parseFloat(setpoints[key]);
      }
    });
    delete setpoints._id
    var collection = dbConnection.collection('setpoints');
    collection.update({}, {$set: setpoints}, function(err){
      if (err) {
        throw err;
      } else {
        res.redirect("/");
      }
    });
  } else {
    res.send("Setpoints not specified", 403);
  }
});

app.get('/last-hour/:collection', function(req, res){
  var col = req.param('collection')
  var collection = dbConnection.collection(col + '10s');
  collection.find({}, {limit: 360, sort: {'$natural': -1}}).toArray(function(err, records){
    if (err) {
      res.send(err.message, 500);
    } else {
      res.jsonp(records);
    }
  });
});


app.get('/last-day/:collection', function(req, res){
  var col = req.param('collection')
  var collection = dbConnection.collection(col + '3m');
  collection.find({}, {limit: 360, sort: {'$natural': -1}}).toArray(function(err, records){
    if (err) {
      res.send(err.message, 500);
    } else {
      res.jsonp(records);
    }
  });
});

var server = app.listen(process.env.PORT || 3000, function() {
  console.log('Listening on port %d', server.address().port);
});

// Setup Server-Side Events for realtime data display
var sse = require('sse-stream')('/rt')
sse.install(server)

sse.on('connection', function(client) {
  // use observe() rather than fork() to avoid adding back-pressure on data
  // processing and storage due to slow client connections.
  var stream = readings.observe();
  stream.map(function(doc){return JSON.stringify(doc)}).pipe(client);
  // make sure to destroy the stream on connection close to avoid mem leaks
  client.once('close', function(){
    stream.destroy();
  });
});

var dbConnection;

MongoClient.connect(store.DB, function(err, db){
  dbConnection = db;
  db.createCollection('setpoints', {}, function(err, collection) {
    if (err) {
      throw err;
    } else {
      if (process.env.KEEZER_SETPOINT || process.env.FERMENTER_SETPOINT) {
        console.log('setting setpoints from process.env');
        collection.update({}, {$set: setpoints}, function(err){
          if (err) {
            throw err;
          }
        });
      } else {
        collection.findOne({}, function(err, settings){
          if(err){
            throw err;
          } else {
            if (settings) {
              console.log('existing setpoints found', settings);
              setpoints = _.extend(setpoints, settings);
            } else {
              console.log('no existing setpoints found in DB');
              collection.insert(setpoints, function(err){
                if (err) {
                  throw err;
                }
              });
            }
          }
        });
      }
    }
  });
});
