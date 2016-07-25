var Rcon = require('rcon');

var config = {
  HOST: 'localhost',
  PORT: 25575,
  PASSWORD: 'password'
}
var rcon = new Rcon(config.HOST, config.PORT, config.PASSWORD);
rcon.connect();

rcon.on('response', function rconResponseHandler(res) {
  console.log('rcon response: ');
  console.log(res);
  rcon.disconnect()
})
rcon.on('error', function rconErrorHandler(err) {
  console.log('rcon threw: ');
  console.log(err);
})

rcon.on('auth', function rconAuthHandler() {
  rcon.send("op yourminecraftusername");
})
