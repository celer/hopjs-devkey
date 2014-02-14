var DevKey = require('../../index');


//The password for the default key is 'password'
DevKey.SignedKeyProvider.sign("key.pem","value:42",function(err,res){
  console.log(err,res);
});

