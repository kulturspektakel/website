<?php	
	kirbytext::$tags['banner'] = array(
		'html' => function($tag) {
			return snippet($tag->attr('banner'));
		}
	);
?>