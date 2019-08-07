const net = require('net');
const EventEmitter = require('events');

const Packet = require('./Packet.js');
/**
 * Used to create and send commands through a console using the RCON protocol
 */
module.exports = class RCON {
  /**
   * @param {Number} [timeout=3000] Timeout for connections and responses
   */
  constructor (timeout = 3000) {
    this.timeout = timeout;
    this.online = false;
    this.authenticated = false;
    this.queue = {
      drained: true,
      sending: [],
      pending: {}
    };
    this.events = new EventEmitter()
      .on('removeListener', (id, listener) => {
        clearTimeout(this.queue.pending[id].timer);
        delete this.queue.pending[id];
      })
      .on('newListener', (id, listener) => {
        this.queue.pending[id] = {
          timer: setTimeout(() => {
            this.events.emit(id, new Error(`Packet timed out!`));
            this.events.off(id, listener);
          }, this.timeout),
          payloads: []
        };
      });
  }
  /**
   * Ends the connection, but doesn't destroy it
   */
  end () {
    this.socket.end();
  }
  /**
   * Immediately sends out as many queued packets as possible
   */
  drain () {
    while (this.queue.drained && this.queue.sending.length > 0) {
      this.queue.drained = this.socket.write(this.queue.sending.shift());
    }
  }
  /**
   * Connects and authenticates the RCON instance
   * @param  {String} server IP from where to find the server
   * @param  {Number} port Port from where to connect
   * @param  {String} password Password with which to connect
   * @return {Promise} Resolves if succesful or Rejects an Error if one occured
   */
  connect (server, port, password) {
    return new Promise((resolve, reject) => {
      let data = Buffer.allocUnsafe(0);
      this.socket = net.connect({ host: server, port: port })
        .on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
          try {
            let length = data.readInt32LE(0);
            while (data.length >= 4 + length) {
              const response = Packet.read(data.slice(0, 4 + length));
              this.events.emit('' + response.id, response);
              data = data.slice(4 + length);
              length = data.readInt32LE(0);
            }
          } catch (error) { /* We don't have enough data yet */ }
        })
        .on('drain', () => { this.drain(); })
        .on('close', () => { this.authenticated = false; this.online = false; })
        .on('error', error => { throw error; })
        .setTimeout(this.timeout, () => {
          this.socket.destroy();
          reject(new Error(`Socket timed out when connecting to [${server}:${port}]`));
        })
        .once('connect', () => {
          this.online = true;
          this.socket.setTimeout(0);
          // Send and process authentication packet
          this.socket.write(Packet.write(0, Packet.type['AUTH'], password));
          this.events.on(0, result => {
            if (result instanceof Error) {
              reject(result);
            } else {
              if (result.type !== Packet.type['AUTH_RES']) {
                reject(new Error(`Packet is of wrong type! [${result.type}]`));
              } else {
                this.events.removeAllListeners(0);
                if (result.id === -1) {
                  reject(new Error(`Authentication failed!`));
                } else {
                  this.authenticated = true;
                  resolve();
                }
              }
            }
          });
        });
    });
  }
  /**
   * Send the given command through authenticated RCON connection
   * @param  {String} command
   * @return {Promise} Resolves to response or Rejects an Error if one occured
   */
  send (command) {
    if (!this.online || !this.authenticated) {
      return Promise.reject(new Error('The connection needs to be made and authenticated first!'));
    } else {
      return new Promise((resolve, reject) => {
        const id = Packet.id();
        this.queue.sending.push(Packet.write(id, Packet.type['COMMAND'], command));
        this.queue.sending.push(Packet.write(id, Packet.type['COMMAND_END'], ''));
        this.drain();
        this.events.on(id, result => {
          if (result instanceof Error) {
            reject(result);
          } else {
            if (result.type !== Packet.type['COMMAND_RES']) {
              reject(new Error(`Packet is of wrong type! [${result.type}]`));
            } else {
              if (result.payload === Packet.payload['COMMAND_END']) {
                const response = this.queue.pending[result.id].payloads
                  .reduce((data, chunk) => data + chunk);
                this.events.removeAllListeners(id);
                resolve(response);
              } else {
                this.queue.pending[result.id].payloads.push(result.payload);
              }
            }
          }
        });
      });
    }
  }
};
