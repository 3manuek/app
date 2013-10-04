/**
 * Extend module's NODE_PATH
 * HACK: temporary solution
 */

var resolve = require('path').resolve;
require(resolve('lib/node-path'))(module);

/**
 * Module dependencies.
 */

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  , passportLocalMongoose = require('passport-local-mongoose')
  , regexps = require('lib/regexps');

/**
 * Define `Citizen` Schema
 */

var CitizenSchema = new Schema({
	  firstName: { type: String }
	, lastName:  { type: String }
	, username:  { type: String }
  , avatar:    { type: String }
  , email:     { type: String, lowercase: true, trim: true, match: regexps.email } // main email
	, address:   { type: String }
	, hometown:  { type: String }
	, location:  { type: String }
	, profiles:  {
        facebook: { type: Object }
      , twitter:  { type: Object }
    }
	, createdAt: { type: Date, default: Date.now }
	, updatedAt: { type: Date }
});

/**
 * Define Schema Indexes for MongoDB
 */

CitizenSchema.index({ createdAt: -1 });
CitizenSchema.index({ firstName: 1, lastName: 1 });

/**
 * Make Schema `.toObject()` and
 * `.toJSON()` parse getters for 
 * proper JSON API response
 */

CitizenSchema.set('toObject', { getters: true });
CitizenSchema.set('toJSON', { getters: true });

/**
 * -- Model's Plugin Extensions
 */

/**
 * Attach PassportJS Local Mongoose helpers
 */

CitizenSchema.plugin( passportLocalMongoose, {
  usernameField: 'email',
  userExistsError: 'Citizen already exists for email %s'
});

/**
 * -- Model's API Extension
 */

/**
 * Get `fullName` from `firstName` and `lastName`
 *
 * @return {String} fullName
 * @api public
 */

CitizenSchema.virtual('fullName').get(function() {
	return this.firstName + ' ' + this.lastName;
});

/**
 * Set `fullName` from `String` param splitting
 * and calling firstName as first value and lastName
 * as the concatenation of the rest values
 *
 * @param {String} name
 * @return {Citizen}
 * @api public
 */

CitizenSchema.virtual('fullName').set(function(name) {
  var split = name.split(' ');
  if(split.length) {
    this.firstName = split.shift();
    this.lastName = split.join(' ');
  }

  return this;
});

/**
 * Find `Citizen` by its email
 * 
 * @param {String} email
 * @return {Error} err
 * @return {Citizen} citizen
 * @api public
 */

CitizenSchema.statics.findByEmail = function(email, cb) {
  return this.findOne({ email: email })
    .exec(cb);
}

/**
 * Find `Citizen` by social provider id
 * 
 * @param {String|Number} id
 * @param {String} social
 * @return {Error} err
 * @return {Citizen} citizen
 * @api public
 */

CitizenSchema.statics.findByProvider = function(profile, cb) {
  var path = 'profiles.'.concat(profile.provider).concat('.id');
  var query = {};
  query[path] = profile.id;
  return this.findOne(query)
    .exec(cb);
}

/**
 * Expose `Citizen` Model
 */

module.exports = mongoose.model('Citizen', CitizenSchema);
