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


server.listen(3000);

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

var dkp = new DevKey.HttpKeyProvider("http://localhost:3000/api/key/:key");
var skp = new DevKey.SignedKeyProvider("key.pub",dkp);
var rkp = new DevKey.RedisCacheKeyProvider(skp,redis.createClient(),3000);
var ckp = new DevKey.CryptoKeyProvider("foofoo",rkp);
var mkp = new DevKey.MemoryCacheKeyProvider(ckp,100);

var signedDevKey="++H4sIAAAAAAAAAwEKAfX+dmFsdWU6NDIrKw8qtHYwsGMyFy1bfinsZMNNdxktDZvCCUdErJjuz4+2pRm9mzn+YNat32kZ7MoOxwmjt36RtM1f7NKbHP9eTLUSDDvVZG+AnXR/cqdcoJ2mFvuXWLTzQ+mzwW8Ra246dsQBrzdOmNYHuWYfyBLZscBIJ1/sPCNbIjP0uAwJayeIPNrt//UjRrzUmuwdcADW3U/yzTjMnCG7c6OLWTSEv6oZtCChgu1nCJ3VRfwIo2MU8h4kAAL4+KT3OrUpOxZ+TcrWOmfh7568jy7hs8glpr/h36d+kvUZHtH1Ya8Sz7Ms01qIoSMDoNwp+tfK9SznY2UTT0Dl3I8cPz78TXuEJApV5x7kCgEAAA=="


Hop.use(DevKey);

Test=function(){

}

Test.keys={
  1:"value:77",
  2:"value:35",
  3:"*",
  4:{ "Test.test":"value:24", "*":"value:12"},
  5:"value:77:44",
  6:{ "Test.test":"value:24", "Test.*":"value:12"},
}

Test.test=function(input,onComplete){
  return onComplete(null,true);
}

Test.test1=function(input,onComplete){
  return onComplete(null,true);
}

Test.key=function(input,onComplete){
  console.log("Request for key",input.devkey);
  return onComplete(null,Test.keys[input.devkey]);
}

Test.genKey=function(input,onComplete){
 return onComplete(null,{ devkey: ckp.encrypt(input.expr) });
}

Hop.defineClass("Test",Test,function(api){
  api.get("test","/test").demand("value").requireDevKey(mkp);
  api.get("test1","/test1").demand("value").requireDevKey(mkp);
  api.get("key","/key/:devkey")
  api.get("genKey","/genkey/:expr")
}); 

Hop.defineTestCase("Test.genKey",function(test){
  test.do("Test.genKey").with({expr:"value:34"}).noError().saveOutputAs("devkey");
  test.do("Test.test").with({value:33},"devkey").errorContains("Permission denied");
  test.do("Test.test").with({value:34},{devkey:signedDevKey}).errorContains("Permission denied");
  test.do("Test.test").with({value:42},{devkey:signedDevKey}).noError();
  test.do("Test.test").with({value:34},"devkey").noError();
  test.do("Test.test").with({value:34},{ devkey: "#:SDFDSARWEREWRDSFSDFSDEWRWER=="}).errorContains("Invalid dev key");
  test.do("Test.test").with({value:77,devkey:1}).noError();
  //Should be cached now
  test.do("Test.test").with({value:77,devkey:1}).noError();
  test.do("Test.test").with({value:77,devkey:1}).noError();
  test.do("Test.test").with({value:76,devkey:1}).errorContains("Permission denied");
  //Let's make sure our error handling is good
  test.do("Test.test").with({value:77,devkey:5}).errorContains("Invalid");
  //Let's see if we can get work with various methods
  test.do("Test.test").with({value:24,devkey:4}).noError();
  test.do("Test.test").with({value:33,devkey:4}).errorContains("Permission denied");
  test.do("Test.test1").with({value:13,devkey:4}).errorContains("Permission denied");
  test.do("Test.test1").with({value:12,devkey:4}).noError();
  
  test.do("Test.test").with({value:24,devkey:6}).noError();
  test.do("Test.test").with({value:33,devkey:6}).errorContains("Permission denied");
  test.do("Test.test1").with({value:13,devkey:6}).errorContains("Permission denied");
  test.do("Test.test1").with({value:12,devkey:6}).noError();
});

Hop.apiHook("/api/",app);

