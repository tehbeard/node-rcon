
var Rcon = require('../node-rcon').newHandle;
var rcon = new Rcon();

rcon.connect("localhost", 25575, "supersecret", onConnected);


function onConnected(err, response){
	if(err){console.error(err);return;}

	console.log("connected", response);
	
	//make superman a op
	var rc = rcon.sendCommand("op superman", function(err, response){
		console.log("result of op:", err, response);	
	});
	
	//revoke his newly found status
	rcon.sendCommand("deop superman", function(err, response){
		console.log("result of deop:", err, response);
	});
	
	rcon.end();
}

