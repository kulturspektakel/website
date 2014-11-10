<div class="row more-event <?php if ($i%2==1) {echo " odd ";} ?>">

	<a class="col-sm-6 col-photo hidden-xs" style="<?php if ($p->hasImages()) echo " background-image:url( '".$p->images()->first()->url()."') "; ?>"></a>

	<div class="col-sm-6 col-info">
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