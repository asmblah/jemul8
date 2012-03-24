<?php
	$data = '';
	
	for ( $i = 0 ; $i < 16 ; ++$i ) {
		for ( $j = 0 ; $j < 16 ; ++$j ) {
			$data .= chr(16 * $i + $j);
		}
		$data .= "\n";
	}
	file_put_contents("out.txt", $data);
?>