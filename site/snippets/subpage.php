<section class="container subpage">
	<h2><?php echo kirbytext($page->title()) ?></h2>
	<?php echo kirbytext($page->intro()) ?>
	<div class="row">
		<?php 
			$cols = array();
			if (!$page->col1()->empty()) array_push($cols, $page->col1());
			if (!$page->col2()->empty()) array_push($cols, $page->col2());
			if (!$page->col3()->empty()) array_push($cols, $page->col3());
			if (!$page->col4()->empty()) array_push($cols, $page->col4());
			
			foreach ($cols as $col) { ?>
			<div class="col-sm-<?= 12/count($cols) ?> <? if(count($cols)==4) echo "col-xs-6"; ?>">
			<? echo kirbytext($col); ?>
			</div>
		<? } ?>
	</div>
	<?php echo kirbytext($page->outro()) ?>
</section>