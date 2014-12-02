<?php	
	kirbytext::$tags['banner'] = array(
		'html' => function($tag) {
			if ($tag->page()->image($tag->attr('banner'))) {
				return snippet('banner', array('image' => $tag->page()->image($tag->attr('banner'))->url()));
			} else {
				return snippet($tag->attr('banner'));
			}
			
		}
	);
?>