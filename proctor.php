<!doctype html>
<html lang="ru">
<head>
	<meta charset="UTF-8">
	<meta name="viewport"
		  content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
	<meta http-equiv="X-UA-Compatible" content="ie=edge">
	<title>Проктор</title>
	<link rel="stylesheet" href="/assets/bootstrap.min.css"/>
	<link rel="stylesheet" href="/style.css"/>

</head>
<body class="container pt-5">

	<h2 class="mb-4">Студенты проходящие тестирование сейчас</h2>
	<div role="actual-testings" class="row">

	</div>

	<h2 class="mb-4 mt-4">Завершенные тестирования</h2>
	<div role="done-testings" class="row">

	</div>

	<template id="actual-testing-template">
		<div class="testing-card card col-sm-12 col-md-6 col-lg-4">
			<div class="card-body text-center">
			<h3 class="card-title" role="name"></h3>
			<p role="date"></p>
			<a href="javascript:;" class="row" data-role="open-video-modal">
				<video class="camera-view col-6 text-center" playsinline autoplay muted></video>
				<video class="screen-view col-6 text-center" playsinline autoplay muted></video>
			</a>
			<a href="javascript:;" class="mt-2 btn btn-danger" data-role="call-user">Позвонить</a>
		</div>
	</template>

	<template id="actual-finished-template">
		<div class="testing-card card card  col-sm-12 col-md-6 col-lg-4">
			<div class="card-body text-center">
				<h3 class="card-title" role="name"></h3>
				<p role="date"></p>
				<p role="finish"></p>
				<div>
					<a href="javascript:;" class="mt-2 btn btn-secondary download-action" data-role="download-1">Запись камеры</a>
					<a href="javascript:;" class="mt-2 btn btn-secondary download-action" data-role="download-2">Запись экрана</a>
				</div>
			</div>
		</div>
	</template>

	<div></div>

	<video class="preview" playsinline autoplay muted></video>

	<div class="modal fade" id="videoModal" tabindex="-1" role="dialog" aria-hidden="true">
		<div class="modal-dialog" role="document" style="max-width: 60%;">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">Modal title</h5>
					<button type="button" class="close" data-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div class="modal-body">
					<video class="col-12 text-center" style="width: 100%;" playsinline autoplay></video>
					<video class="col-12 text-center" playsinline autoplay muted></video>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
				</div>
			</div>
		</div>
	</div>


<script src="RecordRTC.js"></script>
<script src="https://webrtc.github.io/adapter/adapter-latest.js"></script>
<script src="/assets/jquery.min.js"></script>
<script src="/assets/bootstrap.min.js"></script>

<script src="/common.js?<?= rand() ?>"></script>
<script src="/proctor.js?<?= rand() ?>"></script>

</body>
</html>