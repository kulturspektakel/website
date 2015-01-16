<?php	
	kirbytext::$tags['banner'] = array(
		'html' => function($tag) {
			ob_start();
			if ($tag->page()->image($tag->attr('banner'))) {
				snippet('banner', array('image' => $tag->page()->image($tag->attr('banner'))->url()));
			} else {
				snippet($tag->attr('banner'));
			}
			$snippet = ob_get_clean();
			return $snippet;
		}
	);
?>