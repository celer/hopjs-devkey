var http = require('http');
var crypto = require('crypto');
var zlib = require('zlib');
var fs = require('fs');

/**
  Perform an HTTP get to fetch a dev key

  This will perform an HTTP get to load a key and is expected to return the expression associated with the key
  for example 'user.id:10'

  @param {string} url The URL to use ':key' in the url will be replaced with the dev key

  @example
    var provider = new HttpProvider("http://foo.com/key/:key");
  
  @example
    var provider = new HttpProvider("http://foo.com/load_key/?key=:key");

*/
var HttpKeyProvider=function(url){
  this.url=url;
}

HttpKeyProvider.prototype.get=function(key,onComplete){
  var url = this.url.replace(":key",key);
  http.get(url,function(res){
    res.on('data',function(data){
      try { 
        data = data.toString();
        if(data[0]=='"') data = JSON.parse(data);
        return onComplete(null,data);
      } catch(e){
        return onComplete(e);
      }
    });
  }).on('error',function(err){
    return onComplete(err,null);
  });
}

/**
  Read the dev key from redis

  This will simply do a redis 'get' for a certain key, if the keyString is specified
  :key in the keyString will be replaced with the key to get.

  @param {Object} redisClient The Redis client to use
  @param {String} keyString The string to substitude the key value into (as :key) 

*/
var RedisKeyProvider=function(redisClient,keyString){
  this.redisClient=redisClient;
  this.keyString=this.keyString||":key";
}

RedisKeyProvider.prototype.get=function(key,onComplete){
  this.redisClient.get(this.keyString.replace(":key",key),function(err,data){
    if(err) return onComplete(err);
    if(data) return onComplete(null,data.toString());
  });
}

/**
  Cache the keys in redis
  
  @param {Object} provider The key provider to cache keys from
  @param {Object} redisClient The Redis client to use
  @param {Number} duration How long to cache the keys for (in seconds)
  @param {String} keyString The string to substitude the key value into (as :key) 

  @example
    var httpProvider = new HttpProvider("http://foo.com/key/:key");
    var cacheProvider = new RedisCacheProvider(httpProvider,redisClient,10*60,"cache-:key");
*/
var RedisCacheKeyProvider=function(provider,redisClient,duration,keyString){
  this.provider=provider;
  this.redisClient=redisClient;
  this.duration=this.duration||60*5
  this.keyString=this.keyString||"dk-:key";
}

RedisCacheKeyProvider.prototype.get=function(key,onComplete){  
  var self=this;
  var k = this.keyString.replace(":key",key);
  this.redisClient.get(k,function(err,data){
    if(err) return onComplete(err);
    if(data) { 
      return onComplete(null,data.toString());
    } else {
      self.provider.get(key,function(err,expr){
        if(err) return onComplete(err);
        if(expr!=null){ 
          self.redisClient.setex(k,self.duration,expr);
          return onComplete(null,expr);
        }
      }); 
    }
  });
}

CryptoKeyProvider=function(password,provider){
  this.provider=provider;
  this.password=password;
  this.cipher=crypto.createCipher("blowfish",password);
}

CryptoKeyProvider.prototype.get=function(key,onComplete){
  var self=this;
  if(/#:/.test(key)){
    key=key.replace(/^#:/,"");
    try {
      var decipher=crypto.createDecipher("blowfish",this.password);
      var expr="";
      expr+=decipher.update(key,"base64","ascii");
      expr+=decipher.final("ascii");
      return onComplete(null,expr);
    } catch (e){
      return onComplete(e);
    }
  } else {
    return this.provider.get(key,onComplete);
  } 
}

CryptoKeyProvider.prototype.encrypt=function(expr){
  var cipher=crypto.createCipher("blowfish",this.password);
  var key="#:";
  key+=cipher.update(expr,"ascii","base64");
  key+=cipher.final("base64");
  return key;
}

/**
  To create a private key:
    openssl genrsa -des3 -out key.pem 2048 
  To create a public key from your private key:
    openssl rsa -in key.pem -pubout > key.pub

  @example:
    SignedKeyProvider.sign("key.pem","$env.NODE_ENV:production",function(err,key){
      console.log(key);
      var skp = new SignedKeyProvider("key.pub");
      skp.get(key,function(err,res){
        console.log(res);
      });
    });
*/
SignedKeyProvider=function(publicKey,provider){
  this.publicKey=fs.readFileSync(publicKey).toString("ascii");
  this.provider=provider;
}
SignedKeyProvider.sep="++";

SignedKeyProvider.prototype.get=function(key,onComplete){
  var self=this;
  if(key.substr(0,2)==SignedKeyProvider.sep){
    key=key.substr(2);
    var k = new Buffer(key,"base64");
    zlib.gunzip(k,function(err,res){
      if(err) return onComplete(err);
      var r = res.toString("binary");
      r=r.split(SignedKeyProvider.sep);
      var verify = crypto.createVerify("RSA-SHA256");
      verify.update(r[0]);
      var ret = verify.verify(self.publicKey,r[1],'binary');
      if(ret){
        return onComplete(null,r[0]);
      } else {
        return onComplete("Invalid key",null);
      }
    });
  } else {
    if(this.provider){
      this.provider.get(key,onComplete);
    } else {
      return onComplete(null,null);
    }     
  }
}

SignedKeyProvider.sign=function(privateKey,perms,onComplete){
  var privateKey = fs.readFileSync(privateKey).toString('ascii');
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(perms);
  var sig = sign.sign(privateKey, 'binary');
  if(!sig || sig=="") return onComplete("Invalid pass phrase");
  var res = [ perms, sig ].join(SignedKeyProvider.sep);
  zlib.gzip(new Buffer(res,"binary"),function(err,res){
    if(err) return onComplete(err);
    return onComplete(null,SignedKeyProvider.sep+res.toString("base64"));
  });
}

MemoryCacheKeyProvider=function(provider,size){
  this.provider=provider;
  this.size=size;
  this.cache={};
}

MemoryCacheKeyProvider.prototype.get=function(key,onComplete){
  if(this.cache[key]){
     this.cache[key].access=Date.now();
     return onComplete(null,this.cache[key].perms);
  }
  var self=this;
  self.provider.get(key,function(err,perms){
    if(err) return onComplete(err);
    if(perms){
      if(Object.keys(self.cache).length>=self.size){
        var access=Date.now();
        var oldest=null;
        for(var i in self.cache){
          if(self.cache[i].access<access){
            oldest=i;
            access=self.cache[i].access;
          }
        }
        delete self.cache[oldest];
      } 
      self.cache[key]={access:Date.now(), perms: perms};
    }
    return onComplete(err,perms);
  });
}

module.exports={
  HttpKeyProvider:HttpKeyProvider,
  RedisKeyProvider:RedisKeyProvider,
  RedisCacheKeyProvider:RedisCacheKeyProvider,
  CryptoKeyProvider:CryptoKeyProvider,
  SignedKeyProvider:SignedKeyProvider,
  MemoryCacheKeyProvider:MemoryCacheKeyProvider
}
