var path = require('path');
var ast = require('cmd-util').ast;
var iduri = require('cmd-util').iduri;
var _ = require('underscore');
var fs = require('fs');
var bone = require('bone');

exports.jsParser = function(fileObj, options) {
  var astCache, data = fileObj.srcData.toString();
  try {
    astCache = ast.getAst(data);
  } catch(e) {
    console.log('js parse error ' + fileObj.src.red);
    console.log(e.message + ' [ line:' + e.line + ', col:' + e.col + ', pos:' + e.pos + ' ]');
    return;
  }

  var meta = ast.parseFirst(astCache);

  if (!meta) {
    console.log('found non cmd module "' + fileObj.src + '"');
    // do nothing
    return;
  }


  var deps, depsSpecified = false;
  if (meta.dependencyNode) {
    deps = meta.dependencies;
    depsSpecified = true;
    generation(deps);
    // grunt.log.verbose.writeln('dependencies exists in "' + fileObj.src + '"');
  } else {
    parseDependencies(fileObj.src, options, generation);
    // grunt.log.verbose.writeln(deps.length ?
      // 'found dependencies ' + deps : 'found no dependencies');
  }

  function generation(deps) {
    deps = _.compact(deps);
    // create .js file
    astCache = ast.modify(astCache, {
      id: meta.id ? meta.id : unixy(options.idleading + fileObj.name.replace(/\.js$/, '')),
      dependencies: deps,
      require: function(v) {
        // ignore when deps is specified by developer
        return depsSpecified ? v : iduri.parseAlias(options, v);
      }
    });
    data = astCache.print_to_string(options.uglify);
    fileObj.dest(addOuterBoxClass(data, options));
  }
};


// helpers
// ----------------
function unixy(uri) {
  return uri.replace(/\\/g, '/');
}

function getStyleId(options) {
  return unixy((options || {}).idleading || '')
    .replace(/\/$/, '')
    .replace(/\//g, '-')
    .replace(/\./g, '_');
}

function addOuterBoxClass(data, options) {
  // ex. arale/widget/1.0.0/ => arale-widget-1_0_0
  var styleId = getStyleId(options);
  if (options.styleBox && styleId) {
    data = data.replace(/(\}\)[;\n\r ]*$)/, 'module.exports.outerBoxClass="' + styleId + '";$1');
  }
  return data;
}

function moduleDependencies(id, options) {
  var alias = iduri.parseAlias(options, id);

  if (iduri.isAlias(options, id) && alias === id) {
    // usually this is "$"
    return [];
  }

  // don't resolve text!path/to/some.xx, same as seajs-text
  if (/^text!/.test(id)) {
    return [];
  }

  var file = iduri.appendext(alias);

  if (!/\.js$/.test(file)) {
    return [];
  }

  var fpath;
  options.paths.some(function(base) {
    var filepath = path.join(base, file);
    if (bone.fs.existFile(filepath)) {
      console.log('find module "' + filepath + '"');
      fpath = filepath;
      return true;
    }
  });

  if (!fpath) {
    console.log("can't find module " + alias);
    return [];
  }
  if (!bone.fs.existFile(fpath)) {
    console.log("can't find " + fpath);
    return [];
  }
  var data = fs.readFileSync(fpath);
  var parsed = ast.parse(data);
  var deps = [];

  var ids = parsed.map(function(meta) {
    return meta.id;
  });

  parsed.forEach(function(meta) {
    meta.dependencies.forEach(function(dep) {
      dep = iduri.absolute(alias, dep);
      if (!_.contains(deps, dep) && !_.contains(ids, dep) && !_.contains(ids, dep.replace(/\.js$/, ''))) {
        deps.push(dep);
      }
    });
  });
  return deps;
}

function parseDependencies(fpath, options, done) {
  var rootpath = fpath;

  function relativeDependencies(fpath, options, basefile, callback) {
    if (basefile) {
      fpath = path.join(path.dirname(basefile), fpath);
    }
    fpath = iduri.appendext(fpath);

    var deps = [];
    var moduleDeps = {};
    var count = 0;
    if (!bone.fs.existFile(fpath)) {
      if (!/\{\w+\}/.test(fpath)) {
        console.log("can't find " + fpath);
      }
      return callback([]);
    }
    bone.fs.readFile(fpath, function(err, buffer) {
      var data = buffer.toString();
      var parsed;
      try {
        parsed = ast.parseFirst(data);
      } catch(e) {
        console.log(e.message + ' [ line:' + e.line + ', col:' + e.col + ', pos:' + e.pos + ' ]');
        parsed = [];
      }
      parsed.dependencies.map(function(id) {
        return id.replace(/\.js$/, '');
      }).forEach(function(id) {

        if (id.charAt(0) === '.') {
          // fix nested relative dependencies
          if (basefile) {
            var altId = path.join(path.dirname(fpath), id).replace(/\\/g, '/');
            var dirname = path.dirname(rootpath).replace(/\\/g, '/');
            if ( dirname !== altId ) {
              altId = path.relative(dirname, altId);
            } else {
              // the same name between file and directory
              altId = path.relative(dirname, altId + '.js').replace(/\.js$/, '');
            }
            altId = altId.replace(/\\/g, '/');
            if (altId.charAt(0) !== '.') {
              altId = './' + altId;
            }
            deps.push(altId);
          } else {
            deps.push(id);
          }
          if (/\.js$/.test(iduri.appendext(id))) {
            count++;
            return relativeDependencies(id, options, fpath, function(d) {
              count--;
              deps = _.union(deps, d);
              if(!count) {
                callback(deps);
              }
            });
          }
        } else if (!moduleDeps[id]) {
          var alias = iduri.parseAlias(options, id);
          deps.push(alias);

          // don't parse no javascript dependencies
          var ext = path.extname(alias);
          if (ext && ext !== '.js') return;

          var mdeps = moduleDependencies(id, options);
          moduleDeps[id] = mdeps;
          deps = _.union(deps, mdeps);
        }
      });
      if(!count) {
        callback(deps);
      }
    });
  }

  relativeDependencies(fpath, options, null, function(deps) {
    done(deps);
  });
}
