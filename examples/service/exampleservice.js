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

var HopRemote = require('hopjs-remote');

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.urlencoded());
  app.use(express.json());
  app.use(express.methodOverride());
  app.use(app.router);
});

app.engine("jade",require('jade').__express);

app.configure('development', function(){
  app.use(express.errorHandler());
});

//This service only accepts signed devkeys, which the other service will use
var skp = new DevKey.HttpKeyProvider("http://localhost:3001/api/devkey/:key");
var mkp = new DevKey.MemoryCacheKeyProvider(skp,10);

Hop.use(DevKey);

HopRemote.remoteAPI("http://localhost:3001/api/",function(err,api){

  if(err) {
    console.log("Unable to load dev key api:",err);
    process.exit(-1);
  }

  WidgetService={};

  WidgetService.redisClient = redis.createClient();

  WidgetService.widgets={};
  WidgetService.i=0;

  WidgetService.create=function(input,onComplete){
    var i = WidgetService.i++;
    WidgetService.widgets[i]=input.name;
    api.DevKeyService.createRole({devkey:input.devkey,item:i,role:"owner"},function(err,res){
      if(err) return onComplete(new Hop.InternalError(err));
      else return onComplete(null,new Hop.href("WidgetService.get",{devkey: input.devkey, id: i}));
    });
  }

  WidgetService.get=function(input,onComplete){
    api.DevKeyService.getRole({devkey:input.devkey, item:input.id, role:"owner"},function(err,res){
      if(err) return onComplete(new Hop.InternalError(err));
      else if(res) return onComplete(null,WidgetService.widgets[input.id]);
      else return onComplete(null,null); 
    });
  }

  WidgetService.delete=function(input,onComplete){
    api.DevKeyService.getRole({devkey:input.devkey, item:input.id, role:"owner"},function(err,res){
      if(err) return onComplete(new Hop.InternalError(err));
      else if(res){
         delete WidgetService.widgets[input.id];
         return onComplete(null,"",204);
      }
      else return onComplete(null,null); 
    });

  }


  Hop.defineClass("WidgetService",WidgetService,function(api){
    api.each(function(api){
      api.create("create","/widget").demand("name");
      api.get("get","/widget/:id");
      api.del("delete","/widget/:id/:devkey");
    },function(method){
      method.requireDevKey(mkp);
    });
  });


  Hop.defineTestCase("WidgetService.create",function(test){
    //Use the api from the devkey service in our test
    test.use("http://localhost:3001/api/");
    test.do("DevKeyService.create").with({email:"test@test.com"}).noError().saveOutputAs("devkey");
    test.do("WidgetService.create").with({name:"mywidget"},"devkey").noError().saveOutputAs("widget");
    test.do("WidgetService.get").with("widget","devkey").noError().outputContains("mywidget");;
  
    test.do("DevKeyService.create").with({email:"test@test.com"}).noError().saveOutputAs("devkey1");
    test.do("WidgetService.get").with("widget","devkey1").noError().outputIsNull();
    test.do("WidgetService.delete").with("widget","devkey1").noError().outputIsNull();
    
    test.do("WidgetService.delete").with("widget","devkey").noError();
  });


  Hop.apiHook("/api/",app);

  server.listen(3000);

});
