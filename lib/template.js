var path = require('path');
var format = require('util').format;
var iduri = require('cmd-util').iduri;
var ast = require('cmd-util').ast;


exports.tplParser = function(fileObj, options) {
  var dest = fileObj.dest;
  // grunt.log.verbose.writeln('Transport ' + fileObj.src + ' -> ' + dest);

  var id = unixy(options.idleading + fileObj.name.replace(/\.js$/, ''));
  var data = fileObj.srcData.toString();
  var code = format('define("%s", [], "%s")', id, data.replace(/\"/g, '\\\"'));
  var astCache = ast.getAst(code);

  data = astCache.print_to_string(options.uglify);
  dest(data);
};

exports.handlebarsParser = function(fileObj, options) {
  var dest = fileObj.dest;
  // grunt.log.verbose.writeln('Transport ' + fileObj.src + ' -> ' + dest);

  var handlebars = require('handlebars');

  // id for template
  var id = unixy(options.idleading + fileObj.name.replace(/\.js$/, ''));

  // handlebars alias
  var alias = options.handlebars.id;

  var template = [
    'define("%s", ["%s"], function(require, exports, module) {',
    'var Handlebars = require("%s");',
    'var template = Handlebars.template;',
    'module.exports = template(',
    '%s',
    ');',
    '})'
  ].join('\n');

  var data = fileObj.srcData.toString();

  patchHandlebars(handlebars);
  var code = handlebars.precompile(data, options.handlebars);

  var ret = format(template, id, alias, alias, code);
  var astCache = ast.getAst(ret);

  data = astCache.print_to_string(options.uglify);
  dest(data);
};



// patch for handlebars
function patchHandlebars(Handlebars) {
  Handlebars.JavaScriptCompiler.prototype.preamble = function() {
    var out = [];

    if (!this.isChild) {
      var namespace = this.namespace;
      // patch for handlebars
      var copies = [
        "helpers = helpers || {};",
        "for (var key in " + namespace + ".helpers) {",
        "   helpers[key] = helpers[key] || " + namespace + ".helpers[key];",
        "}"
      ].join('\n');
      if (this.environment.usePartial) { copies = copies + " partials = partials || " + namespace + ".partials;"; }
      if (this.options.data) { copies = copies + " data = data || {};"; }
      out.push(copies);
    } else {
      out.push('');
    }

    if (!this.environment.isSimple) {
      out.push(", buffer = " + this.initializeBuffer());
    } else {
      out.push("");
    }

    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = out;
  };
}

function unixy(uri) {
  return uri.replace(/\\/g, '/');
}
