#!/usr/bin/env node

var fs = require('fs');
var program = require('commander');
var timeline = {};
var stack;
var frames;

function Node(name) {
    this.name = name;
    this.value = 0;
    this.children = {};
}

Node.prototype.add = function(frames, value) {
  this.value += value;
  if(frames && frames.length > 0) {
    var head = frames[0];
    var child = this.children[head];
    if(!child) {
      child = new Node(head);
      this.children[head] = child;
    }
    frames.splice(0, 1);
    child.add(frames, value);
  }
}

Node.prototype.serialize = function() {
  var res = {
    'name': this.name,
    'value': this.value
  }

  var children = []

  for(var key in this.children) {
    children.push(this.children[key].serialize());
  };

  if(children.length > 0) res['children'] = children;

  return res;
}

function newStack(name, timestamp) {
  stack = timeline[timestamp];
  if (!stack) {
    stack = new Node('root');
    timeline[timestamp] = stack;
  }
  frames = []
  frames.unshift(name);
}

function stackEvent(func, mod) {
  var re = /^\(/g; // Skip process names
  if (!re.test(func)) {
    func = func.replace(';', ':') // replace ; with :
    func = func.replace('<', '') // remove '<'
    func = func.replace('>', '') // remove '>'
    func = func.replace('\'', '') // remove '\''
    func = func.replace('"', '') // remove '"'
    if(func.indexOf('(') !== -1) {
      func = func.substring(0, func.indexOf('(')); // delete everything after '('
    }
    frames.unshift(func);
  }
}

function endStack() {
  stack.add(frames, 1);
}

function parse(filename, options) {
  fs.readFile(filename, 'utf8', function (err, data) {
    if (err) throw err;
    var lines = data.split("\n"),
        matches,
        re;

    for (var i = 0; i < lines.length; i++) {
      re = /^(\S+\s*?\S*?)\s+(\d+)\/(\d+)\s+\[(\d+)\]\s+(\d+).(\d+)/g;
      matches = re.exec(lines[i]);
      if (matches) {
        newStack(matches[1], matches[5]);
      } else {
        re = /^\s*(\w+)\s*(.+) \((\S*)\)/g;
        matches = re.exec(lines[i]);
        if (matches) {
          stackEvent(matches[2], matches[3]);
        } else {
          re = /^$/g;
          matches = re.exec(lines[i]);
          if (matches) {
            endStack();
          } else {
            re = /^#/g;
            matches = re.exec(lines[i]);
            if (matches) {
              // Comment line. Do nothing.
            } else {
              console.log("Don't know what to do with this: " + lines[i]);
            }
          }
        }
      }
    };
    var out = {};
    for (var timestamp in timeline) {
      out[timestamp] = timeline[timestamp].serialize();
    }
    var json = JSON.stringify(out, null, 2);
    if(options.output) {
      fs.writeFile(options.output, json, function(err) {
        if (err) throw err;
      });
    } else {
      console.log(json);
    }
  });
}

program
  .version('0.0.1')
  .arguments('<filename>')
  .option('-o, --output <filename>', 'Save output to <filename>.')
  .action(parse);

program.parse(process.argv);

if(program.args.length < 1) program.help();
