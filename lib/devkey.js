var fs = require('fs');
var assert = require('assert');
var PEG = require('pegjs');
var path = require('path');

var providers = require('./providers');

try {
  var parser = PEG.buildParser(fs.readFileSync(path.join(__dirname,"perms.pegjs")).toString());
} catch (e){
  console.error(e.stack);
}

/**
  foo.bar.bin:/wolf/ -> matches this regex
  foo.bar[*].wolf.foo.bar -> any element in the object /array bar
  foo.bar[$] -> last element
  foo.bar[^] -> first element
  foo.bar[!] -> all elements 
  foo.bar[5] -> fifth element
  foo.bar[-3] -> third element from the end
*/
var ObjMatcher={};
ObjMatcher.testValue=function(props,value,target){

  var prop=props.shift();
  if(prop){

    var re=/([A-Za-z\_\-\0-9]+)(\[([^\]]+)\])?/
    var mr = re.exec(prop)
    if(mr){
      var prop = mr[1];
      var what = mr[3];
      if(typeof target[prop]!=="undefined"){
        if(typeof what=="undefined"){
          return ObjMatcher.testValue(props,value,target[prop]); 
        } else if(what==="*"){
          if(target[prop] instanceof Array){
            for(var i in target[prop]){
              var p = props.slice(0);
              var ret = ObjMatcher.testValue(p,value,target[prop][i]);
              if(ret===true) return true;
            }
          } else return false;
        } else if(what==="$"){
          if(target[prop] instanceof Array){
            var p = props.slice(0);
            var ret = ObjMatcher.testValue(p,value,target[prop][target[prop].length-1]);
            if(ret===true) return true;
          } else return false;
        } else if(what==="^"){
          if(target[prop] instanceof Array){
            var p = props.slice(0);
            var ret = ObjMatcher.testValue(p,value,target[prop][0]);
            if(ret===true) return true;
          } else return false;
        } else if(what==="!"){
          if(target[prop] instanceof Array){
            for(var i in target[prop]){
              var p = props.slice(0);
              var ret = ObjMatcher.testValue(p,value,target[prop][i]);
              if(ret===false) return false;
            }
            return true;
          } else return false;
        } else if(typeof parseInt(what)=="number"){
            what = parseInt(what);
            var p = props.slice(0);
            if(what<0){
              var i = target[prop][target[prop].length]-what;
            } else {
              var i = what;
            }
            var ret = ObjMatcher.testValue(p,value,target[prop][i]);
            if(ret===true) return true;
        } 
      } else return false;
    } return false;
  } else {
    //Time to test the value
    if(value==target)
      return true;
    else if(value instanceof RegExp){
      return value.test(target);
    } 
    return false;
  }
}


ObjMatcher.test=function(pattern,obj,extraContext){
  if(pattern==="*") return true;
  expr = parser.parse(pattern);

  for(var i in extraContext){
    obj[i]=extraContext[i];
  }   

  var eval = function(expr){
    if(expr.or){
      for(var i=0;i<expr.or.length;i++){
        var ret = eval(expr.or[i]);
        if(ret) return true;
      }
      return false;
    } else if(expr.and){
      for(var i=0;i<expr.and.length;i++){
        var ret = eval(expr.and[i]);
        if(!ret)
          return false;
      }
      return true;
    } else if(expr.not){
      var ret = eval(expr.not);
      return !ret;
    } else {
      var ret = ObjMatcher.testValue(expr.path.split("."),expr.value,obj,extraContext);      
      return ret;
    } 
  }
   
  var ret = eval(expr);
  
  for(var i in extraContext){
    delete obj[i];
  }   

  return ret;
}

var testObj={
  a:{ 
    b:{
      c:[ { foo: true, baz:true}, {foo:false, bar:false,baz:true }, {a:7,baz:true} ],
      d:[ { foo: true}, {foo:false, bar:false } ] 
    }
  },
  a1:{
    b: "wolf"
  }
}

assert.equal(true,ObjMatcher.testValue(["a","b","c[*]","foo"],4,{ a: { b: { c:[{},{},{foo:4},{}] }}}));
assert.equal(false,ObjMatcher.testValue(["a","b","c[$]","foo"],4,{ a: { b: { c:[{},{},{foo:4},{}] }}}));
assert.equal(true,ObjMatcher.testValue(["a","b","c[$]","foo"],4,{ a: { b: { c:[{},{},{},{foo:4}] }}}));
assert.equal(true,ObjMatcher.testValue(["a","b","c[^]","foo"],4,{ a: { b: { c:[{foo:4},{},{},{}] }}}));
assert.equal(false,ObjMatcher.testValue(["a","b","c[!]","foo"],4,{ a: { b: { c:[{foo:4},{foo:4},{foo:4},{}] }}}));
assert.equal(true,ObjMatcher.testValue(["a","b","c[!]","foo"],4,{ a: { b: { c:[{foo:4},{foo:4},{foo:4},{foo:4}] }}}));
assert.equal(true,ObjMatcher.testValue(["a","b","c[2]","foo"],4,{ a: { b: { c:[{},{},{foo:4},{}] }}}));
assert.equal(true,ObjMatcher.testValue(["a","b","c[*]","foo", "b[*]","a"],4,{ a: { b: { c:[{},{},{foo:{b:[{},{a:4}]}},{}] }}}));
assert.equal(true,ObjMatcher.testValue(["a","b","c[*]","a"],7,testObj));

assert.equal(true,ObjMatcher.test("*",testObj));
assert.equal(true,ObjMatcher.test("a1.b:\"wolf\"",testObj));
assert.equal(true,ObjMatcher.test("a1.b:\/wo.+\/",testObj));
assert.equal(false,ObjMatcher.test("a1.b:\/wf.+\/",testObj));
assert.equal(false,ObjMatcher.test("!a1.b:\"wolf\"",testObj));
assert.equal(false,ObjMatcher.test("a1.b:\"wolf1\"",testObj));
assert.equal(false,ObjMatcher.test('a1.b:"wolf" && a.b.c[*].foo:7',testObj));
assert.equal(true,ObjMatcher.test('a1.b:"wolf" && a.b.c[*].foo:true',testObj));
assert.equal(true,ObjMatcher.test('a1.b:"wolf" && a.b.c[*].bar:false',testObj));
assert.equal(false,ObjMatcher.test('a1.b:"wolf" && a.b.c[*].bar:true',testObj));
assert.equal(true,ObjMatcher.test('a1.b:"wolf" && a.b.c[*].a:7',testObj));
assert.equal(false,ObjMatcher.test('a1.b:"wolf" && a.b.c[*].a:8',testObj));
assert.equal(true,ObjMatcher.test('a1.b:"wolf" && ( a.b.c[*].a:8 || a.b.c[*].a:7 )',testObj));
assert.equal(true,ObjMatcher.test('a1.b:"wolf" && a.b.c[!].baz:true',testObj));
assert.equal(false,ObjMatcher.test('a1.b:"wolf" && a.b.c[!].baz:7',testObj));


module.exports=function(Hop){
  Hop.Method.prototype.requireDevKey=function(provider){
    //will require a dev key by ID 
    //FIXME it would be very nice if we could look at headers and info from the session as well!!!
    var self=this;
    this.demand("devkey","The devkey for this call");
    this.addPreCall(function(request,input,onComplete,next){
      try { 
        provider.get(input.devkey,function(err,perms){
          if(err) return onComplete(new Hop.InternalError("Invalid dev key",err));
          if(typeof perms!="string") return onComplete(new Hop.InternalError("Invalid dev key",perms));
          if(perms[0]=='{'){
            try {
              var perms = JSON.parse(perms);
            } catch(e){ 
              return onComplete(new Hop.InternalError("Invalid dev key",e));
            }
            //If the type of perms is an object we will 
            // assume it is a hash of functions to permissions
            if(typeof perms == "object"){
              var method = self.getMethod();
              if(perms[method]){
                perms = perms[method];
              //Fix me add test for a class
              } else if(perms[method.split(".")[0]+".*"]){
                perms = perms[method.split(".")[0]+".*"];
              } else if(perms["*"]){
                perms = perms["*"];
              } else {
                return onComplete(new Hop.AuthError("Permission denied"));
              }
            }
          }

          try { 
            if(ObjMatcher.test(perms,input,{ $session: request.session, $env: process.evn, $headers: request.headers })){
              next();
            } else return onComplete(new Hop.AuthError("Permission denied"));
          } catch(e){
            Hop.error("Error parsing devkey:",perms,e);
            return onComplete(new Hop.InternalError("Invalid dev key",e));
          }
        }); 
      } catch (e){
        return onComplete(new Hop.InternalError("Invalid dev key",e));
      }
    },"auth");
  }
}

for(var i in providers){
  module.exports[i]=providers[i];
}

