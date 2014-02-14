[![Build Status](https://travis-ci.org/celer/hopjs.png)](https://travis-ci.org/celer/hopjs)
[![Depdendency Status](https://david-dm.org/celer/hopjs.png)](https://david-dm.org/celer/hopjs);

# Introduction

This is a small devkey module for HopJS, it provides a basic framework for implementing devkeys.

We define a devkey as simply, a key which describes which is associated with a set of permissions.

For example:

```javascript
  {
    //This key simply says - allow all calls 
    key1:"*",
    //This key says - allow any call which has an input parameter of public=true
    key2:"public:true",
    //This key says - allow any call which has an input of public=true and enabled=false
    key3:"public:true && enabled:false",
    //This key only works when the environmental variable NODE_ENV isn't set to production
    key4:"!$env.NODE_ENV:'production'",
    //This key defines specific permissions for specific functions
    key5:{
            "User.create":"email:/.+\.foo.com/",
            "User.delete":"$session.user.email:/+.foo.com/",
            "MailBox.*":"to:/.+foo.com/",
          },
    //Don't allow this key to use IE
    key6:"!$headers.agent:/MSIE/"
  }
```
DevKeys can be used from a number of different providers:

 * Http - we can fetch a key on demand
 * Redis - we can fetch a key from redis
 * Crypto - we can encode permissions using symmetric encryption
 * Signed - we can use permissions signed with private/public keys
 * RedisCache - we can cache keys in redis
 * MemoryCache - we can cache keys in memory

# Usage

```javascript
  var HopDevKey = require('hopjs-devkey');
    
  //...  

  //Tell hop to use the devkey module
  Hop.use(HopDevKey);
  
  /* Let's setup for how we want to manage dev keys
     1. Hit the memory cache for keys
     2. Hit the symmetric key provider
     3. Hit the redis cache key provider
     4. Hit the signed key provider
     5. Hit the http key provider
  */
  //Fifth we'll use an HTTP key provider
  var dkp = new DevKey.HttpKeyProvider("http://localhost:3000/api/key/:key");
  //Fourth we'll use an public/private key provider
  var skp = new DevKey.SignedKeyProvider("key.pub",dkp);
  //Third we'll look in our redis cache for the key
  var rkp = new DevKey.RedisCacheKeyProvider(skp,redis.createClient(),3000);
  //Second we'll use a symmetic crypto key provider
  var ckp = new DevKey.CryptoKeyProvider("foofoo",rkp);
  //First we'll hit our memory cache of keys
  var mkp = new DevKey.MemoryCacheKeyProvider(ckp,100);

  //...
  
  Hop.defineClass("User",User,function(api){
    api.create("User.create","/user/").demand("email","username").requireDevKey(mkp); 
    api.delete("User.delete","/user/:id").requireDevKey(mkp); 
  });
```

# Where do my dev keys come from?

You will need to decide how you manage and generate them, here are some example scenarios:

 1. You simply use signed keys, you sign a set of permissions and distribute them
 2. You create a simple restful dev key service, and then have it generate keys, see the service example
 3. You create a simple devkey service which allows objects to be associated with devkeys
