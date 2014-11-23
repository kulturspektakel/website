<div class="row more-event">

	<div class="col-sm-6 col-photo <?php if ($i%2==1) {echo " col-sm-push-6 ";} ?>">
		<div class="honeycomb">
		<?php if ($p->hasImages()) echo '<img src="'.thumb($p->images()->first(),array('width' => 800, 'height' => '800', 'crop' => true))->url().'" />'; ?>
		</div>
	</div>
	
	<div class="col-sm-6 col-info <?php if ($i%2==1) {echo " col-sm-pull-6 ";} ?>">
		<h2>
			<?=$p->title() ?>
		</h2>
		<div class="date">
			<?=$p->datum() ?>
		</div>
		<div class="text">
			<?=kirbytext($p->text()) ?>
		</div>
	</div>

</div>