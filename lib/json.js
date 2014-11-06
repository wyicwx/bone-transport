var path = require('path');
var format = require('util').format;
var iduri = require('cmd-util').iduri;
var ast = require('cmd-util').ast;


exports.jsonParser = function(fileObj, options) {
  var dest = fileObj.dest;
  // grunt.log.verbose.writeln('Transport ' + fileObj.src + ' -> ' + dest);

  var id = unixy(options.idleading + fileObj.name.replace(/\.js$/, ''));
  var data = fileObj.srcData.toString();
  var code = format('define("%s", [], %s)', id, data);
  var astCache = ast.getAst(code);

  data = astCache.print_to_string(options.uglify);
  dest(data);
};

function unixy(uri) {
  return uri.replace(/\\/g, '/');
}
