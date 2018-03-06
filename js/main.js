'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;

var streamSender;
var streamReceiver;

var peerConnection;

var videoTagForStreamSender = document.querySelector('#videoTagForStreamSender');
var videoTagForStreamReceiver = document.querySelector('#videoTagForStreamReceiver');
var butttonStartCall = document.getElementById("butttonStartCall");
var buttonEndCall = document.getElementById("buttonEndCall");

var turnReady;

var constraints = {
  video: true
};

var peerConnectionConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};


// var sdpConstraints = { // Set up audio and video regardless of what devices are present.
//   offerToReceiveAudio: true,
//   offerToReceiveVideo: true
// };

// var clientName = prompt("Enter the client name: ");
// var room = prompt("Enter the room name: ");

var room = window.location.hash.substring(1);
if (!room) {
  room = window.location.hash = randomToken();
}

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}
  
// var room = 'foo';

var socket = io.connect();

if (room !== '') {//
  socket.emit('create or join', room);
  log('Attempt to create or join room ' + room);
}

socket.on('showOnClientLog', function(array) {//
  console.log.apply(console, array);
});

socket.on('created', function(room) {//
  log('Created room ' + room);
  isInitiator = true;
});

function log() {//
  var array = ['===== Client: '];
  array.push.apply(array, arguments);
  console.log.apply(console, array);
}

socket.on('joinRequest', function (room){//
  log('Another peer made a request to join room ' + room);
  log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {//
  log('joined: ' + room);
  isChannelReady = true;
});

navigator.mediaDevices.getUserMedia({//
  audio: false,
  video: true
}).then(gotStreamSender).catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStreamSender(stream) {//
  log('Set streamSender to HTML video tag');
  videoTagForStreamSender.src = window.URL.createObjectURL(stream);
  window.streamSender = streamSender = stream;
  videoTagForStreamSender.play();
  sendMessageToServer('got user media');
  if (isInitiator) {
    checkIfTheCallWillStart();
  }
}

function sendMessageToServer(message) {//
  log(message);
  socket.emit('message', message);
}

function checkIfTheCallWillStart() {//
  log('Check if the call will start: ' + 'isStarted: ' + isStarted + ' streamSender: ' + streamSender + ' isChannelReady: ' + isChannelReady);
  if (!isStarted && typeof streamSender !== 'undefined' && isChannelReady) {
    log('Creating peer connection');
    createPeerConnection();
    // peerConnection.addStream(streamSender); // Not throws addstream event
    isStarted = true;
    log('isInitiator: ', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

socket.on('message', function(message) {//
  log('Received message from any client:', message);
  if (message === 'got user media') {
    checkIfTheCallWillStart();
  } 
  else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      checkIfTheCallWillStart();
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } 
  else if (message.type === 'answer' && isStarted) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message)); // Throws addstream event
  } 
  else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peerConnection.addIceCandidate(candidate);
  } 
  else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

function createPeerConnection() {//
  try {
    peerConnection = new RTCPeerConnection(null);
    peerConnection.addStream(streamSender);
    peerConnection.onicecandidate = handleIceCandidate;
    peerConnection.onaddstream = handleRemoteStreamAdded;
    peerConnection.onremovestream = handleRemoteStreamRemoved;
    log('Created RTCPeerConnnection');
  } catch (e) {
    log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function doCall() {//
  log('Sending offer to peer');
  peerConnection.createOffer(onCreateSessionDescriptionSuccess, onCreateSessionDescriptionError);
}

function doAnswer() {//
  log('Sending answer to peer.');
  peerConnection.createAnswer().then(onCreateSessionDescriptionSuccess, onCreateSessionDescriptionError);
}

function handleRemoteHangup() {//
  log('Session terminated.');
  stop();
  isInitiator = false;
}

function handleIceCandidate(event) {//
  log('Ice candidate event: ' + event);
  if (event.candidate) {
    sendMessageToServer({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {//
  log('Remote stream added.');
  videoTagForStreamReceiver.src = window.URL.createObjectURL(event.stream);
  streamReceiver = event.stream;
}

function handleRemoteStreamRemoved(event) {//
  log('Remote stream removed. Event: ' + event);
}

function onCreateSessionDescriptionSuccess(sessionDescription) {//
  // Set Opus as the preferred codec in SDP if Opus is present.
  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  peerConnection.setLocalDescription(sessionDescription);
  log('Set local description and sending message to server for other peer: ', sessionDescription);
  sendMessageToServer(sessionDescription);
}

function onCreateSessionDescriptionError(event) {//
  log('Create session description error: ' + event);
}

// function onCreateSessionDescriptionError(error) {//
//   trace('Failed to create session description: ' + error.toString());
// }

function stop() {//
  isStarted = false;
  peerConnection.close();
  peerConnection = null;
}

// log('Getting user media with constraints', constraints);//

if (location.hostname !== 'localhost') {//
  // requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
}

function requestTurn(turnURL) {//
  var turnExists = false;
  for (var i in peerConnectionConfig.iceServers) {
    if (peerConnectionConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        log('Got TURN server: ', turnServer);
        peerConnectionConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

socket.on('full', function(room) {//
  log('Room ' + room + ' is full');
});

window.onbeforeunload = function() {//
  sendMessageToServer('bye');
};


//=======================================================================================================================================

function hangup() {
  log('Hanging up.');
  stop();
  sendMessageToServer('bye');
}

//=======================================================================================================================================

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}
