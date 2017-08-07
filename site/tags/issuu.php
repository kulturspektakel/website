<?php
	kirbytext::$tags['issuu'] = array(
		'html' => function($tag) {
			return '<div data-configid="'.$tag->attr('issuu').'" style="width:100%; height:600px;" class="issuuembed"></div><script type="text/javascript" src="//e.issuu.com/embed.js" async="true"></script>';
		}
	);
?>
