"use strict";

jQuery(async function($){

	var divActualTestingsWrp = 	$('div[role="actual-testings"]');
	var divDoneTestingsWrp = 	$('div[role="done-testings"]');

	var divVideoModal = 	$('div#videoModal');
	var elModalVideo1 = divVideoModal.find('video')[0];
	var elModalVideo2 = divVideoModal.find('video')[1];
	divVideoModal.on('hide.bs.modal', function(){
		elModalVideo1.srcObject = null;
		elModalVideo2.srcObject = null;
	});


	var videoPreview = $('video.preview');
	var tplActualTesting = $('template#actual-testing-template').html();
	var tplFinishedTesting = $('template#actual-finished-template').html();

	var signaling = new Signaling();
	var connections = [];
	var sids = [];
	var uids = [];

	var camera = null;
	try {
		camera = await navigator.mediaDevices.getUserMedia({
			video: {
				width: { min: 120 },
				height: { min: 80 }},
			audio: true});
		videoPreview[0].srcObject = camera;
	} catch (e) {
		alert('Камера недоступна');
		throw e;
	}

	signaling.requestParams = function(){
		var params = {from: 2, uids: uids, sids: sids};
		return params;
	};
	signaling.message = async function(uid, sid, data){
		if(connections[sid]){
			await connections[sid].gotMessage(data);
		}
	};


	var list = function(callback){

		$.get('server.php', {action: 'list'}, function(ret){
			$('.testing-card').addClass('to-remove');

			if (ret.list){
				for(var key in ret.list){
					var item = ret.list[key];
					var divTesting;

					if(item.active == 1){
						divTesting = divActualTestingsWrp.find('[data-id=' + item.id + ']');

						if(divTesting.length){
							divTesting.removeClass('to-remove');
						} else {
							divTesting = $(tplActualTesting);
							divActualTestingsWrp.append(divTesting);
							divTesting.data('id', item.id);
							divTesting.find('[role=name]').text(item.name);
							divTesting.find('[role=date]').text("Начало: " + item.createdText);

							connectToUser(item, camera, (function(divTesting){
								return function(connection){

									let streams = connection.getPeerConnection().getRemoteStreams();
									var cameraVideo = divTesting.find('video.camera-view')[0];
									var screenVideo = divTesting.find('video.screen-view')[0];
									if(streams && streams.length > 0){
										cameraVideo.srcObject = streams[0];
										if(streams.length > 1){
											screenVideo.srcObject = streams[1]
										}
									}
									divTesting.find('a[data-role="open-video-modal"]').click(function(){
										elModalVideo1.srcObject = cameraVideo.srcObject;
										elModalVideo2.srcObject = screenVideo.srcObject;
										divVideoModal.modal('show');
									});
									divTesting.find('[data-role="call-user"]').click(function(){
										connection.sendDataMessage('call');
									});
									connection.onDataMessage = function(data){
										if (data == 'hangup'){
											alert('Студент прекратил звонок');
										}
									}

								}
							})(divTesting));

						}

					} else {

						divTesting = divDoneTestingsWrp.find('[data-id=' + item.id + ']');

						if(divTesting.length){
							divTesting.removeClass('to-remove');
						} else {
							divTesting = $(tplFinishedTesting);
							divTesting.data('id', item.id);
							divTesting.find('[role=name]').text(item.name);
							divTesting.find('[role=date]').text("Начало: " + item.createdText);
							divTesting.find('[role=finish]').text('Завершение ' + item.accessedText);
							var link = divTesting.find('[data-role=download-1]');
							if(item.cameraUrl){
								link.attr('href', item.cameraUrl);
							} else {
								link.hide();
							}
							link = divTesting.find('[data-role=download-2]');
							if(item.screenUrl){
								link.attr('href', item.screenUrl);
							} else {
								link.hide();
							}
							divDoneTestingsWrp.append(divTesting);
						}
					}

				}
			}
			$('.testing-card.to-remove').remove();
			if(typeof(callback) == 'function'){
				callback();
			}
		});
	};


	var connectToUser = async function(userData, camera, callback){

		var uid = userData.id;
		uids.push(uid);

		var connection = new Connection(function(){
			if(callback){
				callback(connection);
			}
		}, () => {
			console.log('disconnected');
		});

		if(camera){
			connection.addStreams([camera]);
		}

		if(userData.sid){
			var sid = userData.sid;
			sids.push(userData.sid);
			connections[sid] = connection;
			connection.onSendMessage(function(type, data){
				signaling.send({type: type, uid: uid, sid: sid, data:data});
			});
			for (var i = 0; i < userData.messages.length; i++){
				var message = userData.messages[i];
				await connection.gotMessage(message);
			}
		}
	};

	list(function(){
		signaling.start()
	});

});


