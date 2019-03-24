"use strict"

jQuery(function($){

	var formStart = $('form[role="start-form"]');
	var inpName = formStart.find('[name=name]');
	var btnStart = formStart.find('button');
	var divTestingWrp = $('[role="testing-wrapper"]');
	var btnStop = $('[role="stop-testing"]');
	var videoPreview = $('video.preview');
	var divBrowserDetectionConsole = $('.browser-detection-console');

	var uid;
	var recorder= new Recorder(videoPreview[0]);
	var signaling = new Signaling(1);
	var connections = new MultiConnections(signaling);

	var divProctorViewWrp = $('#proctorViewModal');
	var videoProctorView = divProctorViewWrp.find('video.proctor-view');
	divProctorViewWrp.on('hide.bs.modal', function(){
		videoProctorView[0].srcObject = null;
		connections.hangup();
	});

	var browserIsOK = false;

	formStart.submit(function(e){

		e.preventDefault();
		if(!browserIsOK) return;

		try{
			$.get("server.php",{action: 'start', name: inpName.val()},async function (result) {
				if(result.uid){

					uid = result.uid;
					await recorder.start(uid);
					connections.setStreams(recorder.getStreams());
					connections.setSignaling(signaling);
					connections.setUid(uid);
					connections.start();
					signaling.start();

					connections.onCall = function(stream){
						divProctorViewWrp.modal('show');
						videoProctorView[0].srcObject = stream;
					}

					formStart.hide();
					divTestingWrp.show();
					divBrowserDetectionConsole.hide();
				} else if(result.error){
					alert(result.error);
				} else {
					alert("Неизвестная ошибка, обновите страницу и повторите попытку");
				}
			});

		} catch (e) {
		 	throw e;
		 }

		return false;
	});


	btnStop.click(async function(){
		formStart.show();
		divTestingWrp.hide();
		signaling.stop();
		$.get('server.php', {action: 'stop', uid: uid})
		await connections.stop();
		await recorder.stop();
	});

	(async function(){
		browserIsOK = await checkBrowserForWebRTC(function(isError, textMessage){
			if(isError){
				divBrowserDetectionConsole.append($('<div class="alert alert-danger" role="alert">' + textMessage + '</div>'));
			} else {
				divBrowserDetectionConsole.append($('<div class="alert alert-success" role="alert">' + textMessage + '</div>'));
			}
		});

		if (!browserIsOK){
			btnStart.prop('disabled', true);
		}
	})();


});


var MultiConnections = function(){

	var connections = [];
	var sids = [];

	var streams = [];
	var signaling = null;
	var uid = null;
	var that = this;

	this.setStreams = function(lStreams){
		streams = lStreams;
		return that;
	};

	this.setSignaling = function(lSignaling){
		signaling = lSignaling;
		signaling.message = function(uid, sid, data){
			if(connections[sid]){
				connections[sid].gotMessage(data);
			}
		};
		signaling.requestParams = function(){
			return {from: 1, sids: sids, uid: uid};
		};
		return that;
	};

	this.setUid = function(lUid){
		uid = lUid;
		return that;
	};

	this.start = function(){
		var sid = (new Date().getTime()).toString(16);

		var connection = new Connection(function () {
			that.start();
		}, function () {
			connection.close();
			connection = null;
		}, true);

		connection.onSendMessage(function(type, data){
			signaling.send({type: type, uid: uid, sid: sid, data:data});
		});

		connection.onDataMessage = function(data){
			if(typeof(that.onCall) == 'function'){
				var stream = connection.getPeerConnection().getRemoteStreams()[0];
				that.onCall(stream);
			}
		};

		connection.addStreams(streams);

		connection.call();

		connections[sid] = connection;
		sids.push(sid);
	};

	this.stop = function(){
		connections.forEach((connection) => {
			connection.close();
		})
	}

	this.onCall = null;
	this.hangup = function(){
		connections.forEach((connection) => {
			connections.dataMessage('hangup');
		});
	}

};


var Recorder = function(lVideoPreview){

	var videoPreview = lVideoPreview;
	var uid;
	var camera, screen;
	var cameraRecorder, screenRecorder;
	var that = this;

	var openLocalStreams = async function(){
		var ret = {};
		try {
			camera = await navigator.mediaDevices.getUserMedia({video: {
							width: { min: 120, max: 640 },
							height: { min: 80, max: 480 }},
						audio: true});

			camera.oninactive = stop;
		} catch (e) {
			throw "Ошибка при инициализации камеры. " + e.toLocaleString();
		}

		try {
			screen = await navigator.mediaDevices.getDisplayMedia({video: {
					displaySurface: {
						exact: "monitor"
					},
				}});
			screen.oninactive = stop;
			if(screen.getTracks()[0].getSettings().displaySurface != 'monitor'){
				if(screen && screen.active){screen.stop();}
				throw "Необходимо дать разрешение на доступ ко всему экрану";
			}
		} catch (e) {
			throw "Ошибка при инициализации экрана. " + e.toLocaleString();
		}
	}

	this.start = async function(lUid){
		that.uid = lUid;
		await openLocalStreams();

		videoPreview.muted = true;
		videoPreview.srcObject = camera;
		videoPreview.style.display = 'inline-block';

		// initiating the recorder
		cameraRecorder = RecordRTC(camera, {
			type: 'video',
			timeSlice: 60000,
			ondataavailable: upload('camera'),
			disableLogs: true,
		});

		screenRecorder = RecordRTC(screen, {
			type: 'video',
			timeSlice: 60000,
			ondataavailable: upload('screen'),
			disableLogs: true,
		});

		// starting recording here
		cameraRecorder.startRecording();
		screenRecorder.startRecording();

	};

	var stop = async function(){
		if(cameraRecorder){
			await cameraRecorder.stopRecording();
		}
		if(screenRecorder) {
			await screenRecorder.stopRecording();
		}

		that.getStreams().forEach(function(stream){
			if(stream){
				stream.getTracks().forEach(function (track) {
					track.stop();
				});
			}
		});

		cameraRecorder = null;
		screenRecorder =  null;
		camera = null;
		screen = null;

		videoPreview.srcObject = null;
		videoPreview.style.display = 'none';

	}


	this.stop = stop;

	var upload = function(type){
		var counter = 0;
		return function (blob) {
			var lCounter = counter++;

			var fileName = type + '-' + that.uid + '-' + lCounter + '.webm';
			var file = new File([blob], fileName, {type: 'video/webm'});
			var formData = new FormData();
			formData.append('blob', file);
			formData.append('uid', that.uid);
			formData.append('counter', lCounter);
			formData.append('type', type);

			$.ajax({
				url: 'upload.php',
				data: formData,
				cache: false,
				contentType: false,
				processData: false,
				type: 'POST',
				success: function (res) {
					if (res.result == 'success') {
						console.log('successfully uploaded ' + type + ' ' + "(" + lCounter + ")");
					} else if (res.result == 'error') {
						console.log(res.message); // error/failure
					}
				},
				error: function(err){
					console.log(err);
				}
			});
		}
	}


	this.getStreams = function(){
		return [camera, screen];
	};

	var getFileFromRecorder = function(recorder, fileName){
		var blob = recorder.getBlob();
		return new File([blob], fileName, {type: 'video/webm'});
	}

	var getFilePrefix = function(fileExtension) {
		var d = new Date();
		return "" + d.getUTCFullYear() + d.getUTCMonth() + d.getUTCDate()
			+ d.getUTCHours() + d.getUTCMinutes() + d.getUTCSeconds();
	}

}





