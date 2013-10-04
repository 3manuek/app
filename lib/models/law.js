/**
 * Extend module's NODE_PATH
 * HACK: temporary solution
 */

var resolve = require('path').resolve;
require(resolve('lib/node-path'))(module);

var t = require('t-component');

/**
 * Module dependencies.
 */

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  , log = require('debug')('models:law');


/**
 * Law Vote Schema
 */

var Vote = new Schema({
    author: { type: ObjectId, ref: 'Citizen', required: true }
  , value: { type: String, enum: ["positive", "negative", "neutral"], required: true }
  , trustee: { type: ObjectId, ref: 'Citizen' }
  , caster: { type: ObjectId, ref: 'Citizen' }
  , createdAt: { type: Date, default: Date.now }
});

/**
 * Law Schema
 */

var LawSchema = new Schema({
    state: { type: String, enum: ['bill', 'act', 'project'], default: 'bill', required: true }
  , status: { type: String, enum: ['open', 'recount', 'closed'], default: 'open', required: true }
  , lawId: { type: String, required: true }
  , tag: { type:ObjectId, ref:'Tag', required: true }
  , officialTitle: { type: String, required: false }
  , mediaTitle: { type: String, required: false }
  , summary: { type: String, required: false }
  , clauses: [{
        clauseId: { type: String, required: true }
      , order: { type: Number, required: true }
      , text: { type: String, required: true }
    }]
  , votes: [Vote]
  , participants: [{type: ObjectId, ref: 'Citizen' }]
  , createdAt: { type: Date, default: Date.now }
  , updatedAt: { type: Date }
  , closingAt: { type: Date }
});

/**
 * Define Schema Indexes for MongoDB
 */

LawSchema.index({ createdAt: -1 });
LawSchema.index({ state: 1, lawId: 1 }, { unique: true, dropDups: true });

/**
 * Make Schema `.toObject()` and
 * `.toJSON()` parse getters for
 * proper JSON API response
 */

LawSchema.set('toObject', { getters: true });
LawSchema.set('toJSON', { getters: true });

/**
 * -- Model's event hooks
 */

/**
 * Pre update modified time
 *
 * @api private
 */

LawSchema.pre('save', function(next) {
  this.updatedAt = this.isNew ? this.createdAt : Date.now();
  next();
});

/**
 * -- Model's API extension
 */

/**
 * Compile lawId to generate
 * a human readable title
 *
 * @return {String} clauses
 * @api public
 */

LawSchema.virtual('title').get(function() {
  var title = '';
  if ('project' === this.state) title += (t('Project') + ' ');
  if ('bill' === this.state) title += (t('Bill') + ' ');
  if ('act' === this.state) title += (t('Law') + ' ');
  return title.concat(this.lawId);
});

/**
 * Compile clauses to render
 * text content
 *
 * @return {String} clauses
 * @api public
 */

LawSchema.virtual('content').get(function() {
  return this.clauses.sort(function(a, b) {
    var sort = a.order - b.order;
    sort = sort > 0 ? 1 : -1;
    return sort;
  }).map(function(c) {
    if (c.text) return t('Clause') + ' ' + c.clauseId + ': ' + c.text;
  }).join('\n');
});

/**
 * Get `positive` vots
 *
 * @return {Array} voters
 * @api public
 */

LawSchema.virtual('upvotes').get(function() {
  return this.votes.filter(function(v) {
    return "positive" === v.value;
  });
});

/**
 * Get `negative` votes
 *
 * @return {Array} voters
 * @api public
 */

LawSchema.virtual('downvotes').get(function() {
  return this.votes.filter(function(v) {
    return "negative" === v.value;
  });
});

/**
 * Get `neutral` votes
 *
 * @return {Array} voters
 * @api public
 */

LawSchema.virtual('abstentions').get(function() {
  return this.votes.filter(function(v) {
    return "neutral" === v.value;
  });
});

/**
 * Vote Law with provided citizen
 * and voting value
 *
 * @param {Citizen|ObjectId|String} citizen
 * @param {String} value
 * @param {Function} cb
 * @api public
 */

LawSchema.methods.vote = function(citizen, value, cb) {
  if ('recount' === this.status) return cb(new Error('Voting is closed on recount.'));
  if ('closed' === this.status) return cb(new Error('Voting is closed.'));
  // Here we could provide a 5000ms tolerance (5s)
  // or something... to prevent false positives
  if (this.closingAt && (+new Date(this.closingAt) < +new Date) ) return cb(new Error('Can\'t vote after closing date.'));
  
  var vote = { author: citizen, value: value, caster: citizen };
  this.unvote(citizen);
  this.votes.push(vote);
  // Add citizen as participant
  this.participants.push(citizen);
  this.save(cb);
};

/**
 * Unvote Law from provided citizen
 *
 * @param {Citizen|ObjectId|String} citizen
 * @param {Function} cb
 * @api public
 */

LawSchema.methods.unvote = function(citizen, cb) {
  var votes = this.votes;
  var c = citizen.get ? citizen.get('_id') : citizen;

  var voted = votes.filter(function(v) {
    var a = v.author.get ? v.author.get('_id') : v.author;
    return a.equals
      ? a.equals(c)
      : a === c;
  });

  log('About to remove votes %j', voted);
  voted.length && voted.forEach(function(v) {
    var removed = votes.id(v.id).remove();
    log('Remove vote %j', removed);
  });

  if (cb) this.save(cb);
};

/**
 * Close law to prevent future vote casts
 *
 * @param {Function} cb
 * @api public
 */

LawSchema.methods.close = function(cb) {
  if (+new Date(this.closingAt) < +new Date) {
    log('Deny to close law before closing date.');
    return cb(new Error('Deny to close law before closing date.'));
  };
  this.status = 'closed';
  cb && this.save(cb);
}

/**
 * Flag status as `recount` to prevent vote casts
 *
 * @param {Function} cb
 * @api public
 */

LawSchema.methods.recount = function(cb) {
  if (+new Date(this.closingAt) < +new Date) {
    log('Deny to recount law before closing date.');
    return cb && cb(new Error('Deny to recount law before closing date.'));
  };
  this.status = 'recount';
  cb && this.save(cb);
}

/**
 * Expose Mongoose model loaded
 */

module.exports = mongoose.model('Law', LawSchema);

