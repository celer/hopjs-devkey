/**
 * Module dependencies.
 */
var Hop = require("hopjs");


var express= require('express');
var RedisStore = require('connect-redis')(express);
var redis = require('redis');
var app = express();
var server = require('http').createServer(app);
var sessionStore = new RedisStore();
var path = require('path');
var DevKey = require('../../index');


app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.urlencoded());
  app.use(express.json());
  app.use(express.methodOverride());
  app.use(function(req,res,next){
    res.set("Access-Control-Allow-Origin","*"); 
    res.set("Access-Control-Allow-Methods","DELETE, PATCH, PUT, POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers","Content-Type");
    next();
  });
  app.use(app.router);


});

app.engine("jade",require('jade').__express);

app.configure('development', function(){
  app.use(express.errorHandler());
});

//This service only accepts signed devkeys, which the other service will use

DevKeyService={};

DevKeyService.redisClient = redis.createClient();


DevKeyService.create=function(input,onComplete){
  var key = Date.now().toString(36)+"-"+Math.round(Math.random()*1000000).toString(36);

  var details={
    create:Date.now(),
    email:input.email,
    //This user can do anything on the example service
    perms:{
      "WidgetService.*":"*"
    }
  }

  DevKeyService.redisClient.set(key,JSON.stringify(details),function(err){
    if(!err){
      //Here we'd actualy send an email to the user with their key
      return onComplete(null,new Hop.href("DevKeyService.get",{devkey:key}));
    } else {
      return onComplete(new Hop.InternalError(err));
    } 
  });
}

DevKeyService.get=function(input,onComplete){
  DevKeyService.redisClient.get(input.devkey,function(err,res){
    if(err) return onComplete(new Hop.InternalError(err));
    if(res){
      var details = JSON.parse(res);
      return onComplete(null,details.perms);
    }
  });
}

DevKeyService.createRole=function(input,onComplete){
  DevKeyService.redisClient.set(input.devkey+":"+input.item+":"+input.role,"1",function(err){
    if(err) return onComplete(new Hop.InternalError(err));
    return onComplete(null, new Hop.href("DevKeyService.getRole",input)); 
  }); 
}

DevKeyService.getRole=function(input,onComplete){
  DevKeyService.redisClient.get(input.devkey+":"+input.item+":"+input.role,function(err,res){
    if(err) return onComplete(new Hop.InternalError(err));
    else if(res) return onComplete(null,true);
    else return onComplete(null,null);
  });
}


Hop.defineClass("DevKeyService",DevKeyService,function(api){
  api.create("create","/devkey").demand("email");
  api.get("get","/devkey/:devkey");
  api.create("createRole","/devkey/:devkey/associate/:item/:role");
  api.get("getRole","/devkey/:devkey/associate/:item/:role");
});


Hop.apiHook("/api/",app);

server.listen(3001);

