<?php	
	kirbytext::$tags['banner'] = array(
		'html' => function($tag) {
			ob_start();
			if ($tag->page()->image($tag->attr('banner'))) {
				return '</section><section class="banner photo" style="background-image: url('.$tag->page()->image($tag->attr('banner'))->url().')"></section><section class="container subpage">';
			} else {
				return snippet($tag->attr('banner'));
			}
		}
	);
?>