<section class="container subpage <?php echo strtolower($page->title()) ?>">
	<div class="intro">
		<?php echo kirbytext($page->intro()) ?>
	</div>
	<div class="row">
		<?php 
			$cols = array();
			if (!$page->col1()->empty()) array_push($cols, $page->col1());
			if (!$page->col2()->empty()) array_push($cols, $page->col2());
			if (!$page->col3()->empty()) array_push($cols, $page->col3());
			if (!$page->col4()->empty()) array_push($cols, $page->col4());
			
			foreach ($cols as $col) { ?>
			<div class="col-sm-<?= 12/count($cols) ?> <?php if(count($cols)==4) echo "col-xs-6"; ?>">
			<?php echo kirbytext($col); ?>
			</div>
		<?php } ?>
	</div>
	<?php echo kirbytext($page->outro()) ?>
</section>