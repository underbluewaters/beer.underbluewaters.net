// Store.js
// Store provides an api to return a writable collection stream that can be
// used to store sensor data to a mongodb database.

"use strict";

var MongoClient = require('mongodb').MongoClient,
    _ = require('highland'),
    DB = process.env.DB || "mongodb://localhost:27017/beer",
    COLLECTION_SIZE = process.env.COLLECTION_SIZE || 52428800, // 50mb
    collections = _();

// calling module.exports.collection will add a new, paused stream to the
// collections stream. Pause this collection so that it can be resumed and
// a new capped collection can be created for each member after a connection
// to mongodb is established.
collections.pause();

MongoClient.connect(DB, function(err, db) {
  if(err) {
    throw err;
  } else {
    collections.each(function(stream){
      var name = stream.__collectionName__;
      var opts = {capped:true, size: stream.__collectionSize__};
      // This will create a collection only if one does not already exist
      db.createCollection(name, opts, function(err, collection) {
        if (err) {
          throw err;
        } else {
          stream.each(function(doc){
            collection.insert(doc, function(err, doc){
              if (err) {
                throw err;
              }
            });
          });
          // Streams are paused to await mongodb connection and the creation
          // of the appropriate capped collection
          stream.resume();
        }
      });
    });
    // Start creating collections for any collection streams
    // already requested.
    collections.resume();
  }
});

var usedNames = [];

module.exports = {
  // Returns a stream that new records can be piped to. They will be saved
  // to a capped collection in mongodb after connecting
  collection: function(name, opts){
    var opts = opts || {};
    if (usedNames.indexOf(name) !== -1) {
      throw new Error('Collection name '+name+' already in use.');
    } else {
      var stream = _();
      stream.__collectionName__ = name;
      stream.__collectionSize__ = opts.size || COLLECTION_SIZE
      stream.pause();
      collections.write(stream);
      return stream;
    }
  },
  DB: DB
}
