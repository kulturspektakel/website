<?php	
	kirbytext::$tags['honeycomb'] = array(
		'html' => function($tag) {
			echo '<div class="honeycomb">';
			echo '<img src="'.thumb($tag->page()->image($tag->attr('honeycomb')), array('width' => 200,'height' => 200, 'crop' => true))->url().'" />';
			echo '</div>';
		}
	);
?>