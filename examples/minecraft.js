var RCON = require('../RCON');
var rcon = new RCON();

rcon.connect('localhost', 22575, 'supersecret')
  .then(() => {
    console.log('Connected and authenticated.');
    return rcon.send('/op superman');
  })
  .then(response => {
    console.log(`Result of op: ${response}`);
  })
  .catch(error => {
    console.error(`An error occured: ${error}`);
  });

rcon.send('/deop superman')
  .then(response => {
    console.log(`Result of deop: ${response}`);
  })
  .catch(error => {
    console.error(`An error occured: ${error}`);
  });
