<?php	
	kirbytext::$tags['honeycomb'] = array(
		'html' => function($tag) {
			$r = '<div class="honeycomb">';
			$r .= '<img src="'.thumb($tag->page()->image($tag->attr('honeycomb')), array('width' => 200,'height' => 200, 'crop' => true))->url().'" />';
			$r .= '</div>';
			return $r;
		}
	);
?>