var bone = require('bone');
var text = require('./lib/text');
var script = require('./lib/script');
var style = require('./lib/style');
var template = require('./lib/template');
var json = require('./lib/json');
var path = require('path');
var cmd = require('cmd-util');
var _ = require('underscore');

module.exports = bone.wrapper(function(buffer, encoding, callback) {

  var options = this.option.defaults({
    paths: ['sea-modules'],

    idleading: '',
    alias: {},

    // process a template or not
    process: false,

    // define parsers
    parsers: {
      '.js': script.jsParser,
      '.css': style.cssParser,
      '.html': text.html2jsParser,
      '.json': json.jsonParser,
      '.tpl': template.tplParser,
      '.mustache': text.html2jsParser,
      '.handlebars': template.handlebarsParser
    },

    // for handlebars
    handlebars: {
      id: 'gallery/handlebars/1.0.2/runtime',
      knownHelpers: [],
      knownHelpersOnly: false
    },

    // output beautifier
    uglify: {
      beautify: true,
      comments: true
    },

    // https://github.com/aliceui/aliceui.org/issues/9
    styleBox: false
  });

  if (options.process === true) {
    options.process = {};
  }

  var extname = path.extname(this.source);
  var fileparsers = options.parsers[extname];

  if (!fileparsers) {
    callback(null, buffer);
    return;
  }
  var cwd = options.cwd || '~';
  cwd = bone.fs.pathResolve(cwd);
  fileparsers({
    src: this.source,
    srcData: buffer,
    name: path.relative(cwd, this.source),
    dest: function(buffer) {
      callback(null, buffer);
    }
  }, options);

});
