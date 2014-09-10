<?php	
	kirbytext::$tags['soundcloud'] = array(
	  'html' => function($tag) {
		return '<iframe width="100%" height="162" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url='.$tag->attr('soundcloud').'&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=false"></iframe>';
	  }
	);
?>