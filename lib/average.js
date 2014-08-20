// Average.js
// Average values coming from a highland stream every given milliseconds.

"use strict";

var _ = require('highland'),
    convertToMs = require('ms');

module.exports = function average(duration, source){
  var ms;

  if (typeof duration === 'string') {
    ms = convertToMs(duration);
  } else {
    ms = duration;
  }

  var i = 0,
      sum = 0,
      pushFunction;

  function step(err, x, push, next){
    var now = new Date().getTime();
    pushFunction = push;

    if (err) {
      // pass errors along the stream and consume next value
      push(err);
      next();
    } else if (x === _.nil) {
      // pass nil (end event) along the stream
      push(null, x);
    } else {
      if (x.__finish__) {
        if (i > 0) {
          push(null, {average: sum / i, duration: ms, end: new Date(), samples: i});
        } else {
          var err = new Error('No samples recorded while averaging ('+duration+').');
          err.__HighlandStreamError__ = true
          push(err);
        }
        i = sum = 0;
        setTimeout(finish, ms);
        next();
      } else {
        sum += x;
        i++;
        next();
      }
    }
  }

  var stream = source.consume(step)

  function finish(){
    // This is kind of a hack. After the averaging interval we send this
    // special packet to the source stream and the step function finds it,
    // triggering a push of the final averaged data.
    source.write({__finish__: true});
  };

  setTimeout(finish, ms);
  return stream;
}
