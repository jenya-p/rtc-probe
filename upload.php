<?php
// Muaz Khan     - www.MuazKhan.com
// MIT License   - https://www.webrtc-experiment.com/licence/
// Documentation - https://github.com/muaz-khan/RecordRTC

header("Access-Control-Allow-Origin: *");
error_reporting(E_ALL);
ini_set('display_errors', 1);

set_error_handler("errorHandler");

function errorHandler($errno, $errstr) {
	echo json_encode([
		'result' => 'error',
		'message' => $errstr,
	]);
}


if (!isset($_POST['counter'])) {
	echo 'Empty counter'; return;
}

if (!isset($_POST['uid'])) {
	echo 'Empty recording uid'; return;
}

$counter = $_POST['counter'];
$uid = $_POST['uid'];
$type = $_POST['type'];

if (!empty($_FILES['blob'])) {
	$tempName = $_FILES['blob']['tmp_name'];
	copyUploaded($tempName, __DIR__.DIRECTORY_SEPARATOR.'upload'.
		DIRECTORY_SEPARATOR.$uid.DIRECTORY_SEPARATOR.$type.'.webm');
}

/*
$upload_max_filesize = return_bytes(ini_get('upload_max_filesize'));

if ($_FILES[$file_idx]['size'] > $upload_max_filesize) {
   echo 'upload_max_filesize exceeded.';
   return;
}

$post_max_size = return_bytes(ini_get('post_max_size'));

if ($_FILES[$file_idx]['size'] > $post_max_size) {
   echo 'post_max_size exceeded.';
   return;
}
*/

function copyUploaded($srcFileName, $dstFileName){

	if(!is_dir(dirname($dstFileName))){
		mkdir(dirname($dstFileName), 0777, true);
	}

	$extension = pathinfo($dstFileName, PATHINFO_EXTENSION);
	if (!$extension || empty($extension) || !in_array($extension, ['webm','wav','mp4','mkv','mp3','ogg'])) {
		throw new \Exception('Invalid file extension: '.$extension) ;
	}

	if(is_file($dstFileName)){
		$dstFile = fopen($dstFileName, 'ab+');
		fwrite($dstFile, file_get_contents($srcFileName));
		fclose($dstFile);
	} else if (!move_uploaded_file($srcFileName, $dstFileName)) {
		if(!empty($_FILES["file"]["error"])) {
			$listOfErrors = array(
				'1' => 'The uploaded file exceeds the upload_max_filesize directive in php.ini.',
				'2' => 'The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form.',
				'3' => 'The uploaded file was only partially uploaded.',
				'4' => 'No file was uploaded.',
				'6' => 'Missing a temporary folder. Introduced in PHP 5.0.3.',
				'7' => 'Failed to write file to disk. Introduced in PHP 5.1.0.',
				'8' => 'A PHP extension stopped the file upload. PHP does not provide a way to ascertain which extension caused the file upload to stop; examining the list of loaded extensions with phpinfo() may help.'
			);
			$error = $_FILES["file"]["error"];

			if(!empty($listOfErrors[$error])) {
				throw new \Exception($listOfErrors[$error]);
			}
			else {
				throw new \Exception('Not uploaded because of error #'.$_FILES["file"]["error"]);
			}
		}
		else {
			throw new \Exception('Problem saving file: '.$srcFileName);
		}
	}

}



echo json_encode(['result' => 'success']);
