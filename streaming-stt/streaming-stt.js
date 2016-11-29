module.exports = function(RED) {
  'use strict';

  var SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
  var Mic = require('./microphone.js');

  function StreamingStt(config) {
    RED.nodes.createNode(this, config);
    this.cmd = config.cmd;
    var node = this;

    var username = this.credentials.username;
    var password = this.credentials.password;
    this.model = config.model;

    var micOption = {};
    micOption.command = node.cmd;
    var mic = new Mic(micOption);
    var speech_to_text= new SpeechToTextV1({
            username: username,
            password: password
          });
    var voice = null;
    var watson = null;
    var listening = false;

    this.on('input', function(msg) {
      var requestToListen = msg.payload;

      if (requestToListen === undefined) {
        node.warn('Need to specify msg.listening bool property.');
        return;
      }

      if (listening && requestToListen) {
        node.warn('Speech node is already listening, stop before starting a new connection.', msg);
        return;
      }

      switch(requestToListen) {
        case false: {
          // stop listening
          mic.stopRecording();
          voice = null;
          if (watson === null) {
            node.warn('There is no connectio to watson that we can stop.');
            return;
          }
          // we aren't listening or are in the process of shuting down our ears.
          if (!listening) {
            node.warn('You need to start a session before you can stop it.');
            return;
          }
          watson.stop();
        }
        return;
        case true: {
          // start listening
          // we are already listeing.
          if(listening) {
            node.warn('We are already listening.');
            return;
          }

          listening = true;
          node.status({fill:'yellow',shape:'ring',text:'requesting'});
          voice = mic.startRecording();
          watson = speech_to_text.createRecognizeStream({ content_type: 'audio/wav' , model: this.model });

          watson.on('results', function(data) {
            msg.payload = data;
            node.send([msg,null],null);
          }).on('listening',function(){
            node.status({fill:'green',shape:'ring',text:'listening'});
            node.send([null,{payload:'LISTENING'},null]);
          }).on('connect', function(){
            node.status({fill:'green',shape:'dot',text:'connected'});
            node.send([null,{payload:'CONNECTED'},null]);
          }).on('close', function(reasonCode, description){
            listening = false;
            node.log('Closed with code '+reasonCode+', '+description);
            node.status({fill:'yellow',shape:'dot',text:'closed'});
            node.send([null,{payload:'CLOSED'},null]);
          }).on('error', function(err){
            listening = false;
            node.status({fill:'red',shape:'dot',text:'error'});
            node.send([null,{payload:'ERROR'},null]);
          }).on('stopping', function(){
            listening = false;
            node.status({fill:'yellow',shape:'ring',text:'stopping'});
            node.send([null,{payload:'STOPPING'},null]);
          });

       	  voice.on('data', (chunk) => {	
  		      node.send([null, null, {payload:chunk}]);
	        });
          
          // pipe your recorded voice to watson sttws
          voice.pipe(watson);
        }
        break;
        default:
        return;
      }
    });

    this.on('close', function(){
      // if we aren't listening we have nothing to clean up
      if (!listening)
        return;
        mic.stopRecording();
        watson.stop();
    });

  }

  RED.nodes.registerType('streaming-stt', StreamingStt,{
    credentials: {
      username: {type: 'text'},
      password: {type: 'password'}
    }
  });
};
