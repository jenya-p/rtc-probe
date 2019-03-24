"use strict";

/**
 * Проверяем браузер на пригодность
 * @param callback
 * @returns {Promise<boolean>}
 */
var checkBrowserForWebRTC = async function(callback){
	var hasError = false;

	var showMessage = function(error, message){
		if(error){
			hasError = true;
		}
		if(callback){
			callback(error, message);
		}
	};

	if(    ! "connection" in navigator
		|| ! "downlink" in navigator.connection
		|| ! "mediaDevices" in navigator
		|| ! "getUserMedia" in navigator.mediaDevices
		|| ! "getDisplayMedia" in navigator.mediaDevices ){

		showMessage( true,	'Ваш браузер устарел, используйте актуальную версию Chrome');
	} else {
		showMessage( false,	'Версия браузера - ОК');
	}

	if( navigator.connection.downlink < 1 ){
		showMessage( true,	'Слишком медленное соединение с интернетом, возможны проблемы с загрузкой видео');
	} else {
		showMessage( false,	'Скорость соединения с интернет - ОК');
	}

	var hasAudio, hasVideo = false;
	(await navigator.mediaDevices.enumerateDevices()).forEach(function(device){
		if(!hasAudio && device instanceof InputDeviceInfo && device.kind == 'audioinput'){
			hasAudio = true;
		}
		if(!hasVideo && device instanceof InputDeviceInfo && device.kind == 'videoinput'){
			hasVideo = true;
		}
	});
	if( hasAudio ){
		showMessage( false,	'Микрофон - ОК');
	} else {
		showMessage( true,	'Микрофон не обнаружен');
	}

	if( hasVideo ){
		showMessage( false,	'Видеокамера - ОК');
	} else {
		showMessage( true,	'Видеокамера не обнаружена');
	}

	return !hasError;


}

var Connection = function(onConnect, onDisconnect, createDataChannel){

	var that = this;

	var pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
	var pc_constraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]};
	var peerConnection = new RTCPeerConnection(pc_config, pc_constraints);

	if(createDataChannel){
		that.dataChanel = peerConnection.createDataChannel('Chat #' + Math.random());
		that.dataChanel.addEventListener('message', e => {that.gotDataMessage(e)});
	} else {
		peerConnection.ondatachannel = function(){
			that.dataChanel = event.channel;
			that.dataChanel.addEventListener('message', e => {that.gotDataMessage(e)});
		}
	}


	this.gotDataMessage = function(e){
		if(typeof(this.onDataMessage) == "function" && e.data){
			that.onDataMessage(e.data);
		}
	};

	this.sendDataMessage = function(data){
		if(that.dataChanel.send(data));
	};

	this.onDataMessage = null;

	this.getPeerConnection = function(){
		return peerConnection;
	};

	this.addStreams = function(streams){
		streams.forEach(function(stream){
			if(stream){
				stream.getTracks().forEach(track => {
					peerConnection.addTrack(track, stream);
				});
			}
		});
	};

	this.close = function(){
		peerConnection.close();
	}

	// Функция для получения сообщений из соединения
	var sendMessage = null;

	this.onSendMessage = function(fnc){
		sendMessage = fnc;
	};

	var _sendToServer = function (type, data){
		if(typeof (sendMessage) == 'function'){
			sendMessage(type, data);
		}
	}

	this.call = async function(){
		var offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		_sendToServer('offer', offer.sdp);
	};

	var gotServerMessage = async function (dataItem){
		if(dataItem.type == 'answer' ){
			try {
				await peerConnection.setRemoteDescription({type: 'answer', sdp: dataItem.data});
				//console.log('answer OK');
			} catch (e) {
				console.log('answer ERROR ' + e.toLocaleString());
			}
		} else if(dataItem.type == 'offer'){
			try {
				await peerConnection.setRemoteDescription({type: 'offer', sdp: dataItem.data});
				//console.log('offer OK');
				var answer = await peerConnection.createAnswer();
				await peerConnection.setLocalDescription(answer);
				_sendToServer("answer", answer.sdp);
				//console.log('answer send OK');
			} catch (e) {
				console.log('offer ERROR ' + e.toLocaleString());
			}

		} else if (dataItem.type == 'candidate') {
			try {
				var candidate = new RTCIceCandidate(JSON.parse(dataItem.data));
				await peerConnection.addIceCandidate(candidate);
				//console.log('ice candidate OK');
			} catch (e) {
				console.log('ice candidate ERROR ' + e.toLocaleString());
			}
		}
	};

	// Функция для передачи сообщений в соединение
	this.gotMessage = gotServerMessage;

	peerConnection.onicecandidate = function(event){
		if(event.candidate){
			let jsnCandidate = JSON.stringify(event.candidate.toJSON());
			_sendToServer('candidate', jsnCandidate);
		}
	}

	peerConnection.onconnectionstatechange = function(event){
		let state = peerConnection.connectionState;
		if(state == 'connected' && onConnect){
			onConnect();
		} else if ((state == "failed" ||  state == "disconnected" || state == "disconnected") && onDisconnect){
			peerConnection.close();
			onDisconnect();
		}
	};



};


var Signaling = function(){


	this.requestParams = null;
	this.message = null;
	this.gotuid = null;
	this.dataToSend = [];
	this.timer = null;
	var that = this;

	this.checked = function(data){
		if (data.messages){
			for (var i = 0; i < data.messages.length; i++){
				var mes = data.messages[i];
				if(typeof(that.message) == "function"){
					that.message(mes.uid, mes.sid, mes);
				}
			}
		}
	}

	this.check = function(){
		var params = [];
		if(typeof(this.requestParams) == 'function'){
			params = this.requestParams();
		}
		if(this.dataToSend.length){
			params['data'] = JSON.stringify(this.dataToSend);
			$.post('server.php', params, function(responce){that.checked(responce)});
			this.dataToSend = [];
		} else {
			$.get('server.php', params, function(responce){that.checked(responce)});
		}
	}

	this.send = function(dataItem){
		this.dataToSend.push(dataItem);
	}


	this.start = function(){
		this.stop();
		this.resetInterval(1500);
	}


	this.stop = function(){
		this.dataToSend = [];
		if(this.timer){
			clearInterval(this.timer); this.timer = null;
		}
	};



	this.resetInterval = function(interval = 1500){
		if(this.timer){
			clearInterval(this.timer);
			this.timer = null;
		}
		if(interval){
			this.timer = setInterval(function(){that.check()}, interval);
			// this.timer = setTimeout(function(){that.check()}, interval);
		}
	}



}

