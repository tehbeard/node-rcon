var net = require('net');

var AUTH_TYPE=0x03;
var COMMAND_TYPE=0x02;
var AUTH_RES_TYPE=0x02;
var TIMEOUT=2000; //time to wait for a response

module.exports.newHandle = function(){
this.socket=null;
this.reqID=1;
this.authed = false;
this.online = false;

this.isOnline = function() {return this.online;}//return online status of connection

//queue management
this.queue = {}; //keeps track of commands sent
/**
* Add a call to the queue and start the timeout.
* @param {Number} Request id
* @param {Function} callback
*/
this._addQueue = function(id, callback){
	if (typeof(callback)==='undefined')return;
	var q = this.queue;
	var t = setTimeout(function(){
		delete q[id]; //drop the timed out request from the queue 
		callback({error:'Timed out'});
	},TIMEOUT);
	this.queue[id]={callback:callback, timeout:t};
};

/**
* Check if we have a request matching the response
* @param {Object} response object
*/
this._processQueue = function(response){
  //do we have anything on the queue that matches.
  if(response.reqID in this.queue){
    var q = this.queue[response.reqID];
    //clear the timeout!
    clearTimeout(q.timeout);
    //callback
    q.callback(null, response);
    //delete from the queue
    delete this.queue[response.reqID];	
  }
}


//connect command
this.connect = function(ip,port,password,callback){
	if(typeof(callback)==='undefined'){callback = function(err, response){};}
        this.socket = net.createConnection(port,ip);
        this.socket.rcon = this;
        this.socket.on('close',function(){this.rcon.authed=false;this.rcon.online=false});
        this.socket.on('connect',function(){
          this.rcon.online=true;
          this.write(this.rcon.makePacket(0,AUTH_TYPE,password));
        });	
        this.socket.on('data',function(data){
          var responses = this.rcon.readPacket(data);
	  for(var i=0; i<responses.length;i++){
	    var response = responses[i]; 
            if(response.type === AUTH_RES_TYPE){
              if(response.reqID == -1){
                this.destroy();
                callback('AUTH FAILED');
                return;	
              }else{
		this.rcon.authed=true;
		callback(null, response); 
		return;
	      }
            }
	    this.rcon._processQueue(response);
	  }
        });
      };

//end connection
this.end = function(){
	this.socket.end();
}


this.sendCommand = function(command,callback) {
	var msg;
	if (typeof(callback)==='undefined') {callback = function(err, response){};}
        if(!this.online){msg={"error":'Not Online'};callback(msg);return msg;}
        if(!this.authed){msg={"error":'Not Authenticated'};callback(msg); return msg;}
        var id = this.reqID+0;
	this.socket.write(this.makePacket(id,COMMAND_TYPE,command));
        this._addQueue(id, callback);
	
	this.reqID +=1;
        return {"reqID":id};
       };


       
//makes a packet for RCON
this.makePacket = function(req,type,S1){
        var b = new Buffer(14+S1.length);
        b.writeInt32LE(10+S1.length,0);
        b.writeInt32LE(req,4);
        b.writeInt32LE(type,8);
        b.write(S1,12);
        b.writeInt16LE(0,(12+S1.length));
        return b;      
      }

//read a packet out into a JSON object
this.readPacket = function(packet){
  var responses=[];
  var haveMore=true;
  var size, res;
  while(haveMore){
    size = packet.readInt32LE(0);
    res = {
      size: size,
      reqID: packet.readInt32LE(4),
      type: packet.readInt32LE(8),
      data:packet.toString('utf8',12,size+2) //don't read beyond response size
      };
    responses.push(res);
    //there are more to read, at least one additional response
    if(packet.length > size+4){
	//position on the next one
	packet = packet.slice(size+4);
    }
    else{
      //no more responses
      haveMore=false;
    }
  }
  //always return an array even if only one response
  return responses;
  };
return this;
};


