<?php
	$textFile = $_GET['path'];
	
	$data = file_get_contents($textFile);
	
	header('Content-Type: text/plain; charset=x-user-defined');
	//header('Content-Type: application/octet-stream');
	header('Content-Length: ' . strlen($data));
	echo $data;
?>