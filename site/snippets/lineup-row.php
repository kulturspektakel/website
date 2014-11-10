<div class="col-sm-4 day-col day-<?=$tag ?>">
	<h2>
		<?=$tag ?>
	</h2>
	<ul class="bandlist">
		<?php foreach ($bands as $band) { ?>
		<li data-stage="<?= $band->stage() ?>">
			<a href="<?= $band->url() ?>" class="<?php if (strlen($band->shortdescription())==0 && !$band->hasImages()) {echo "no-content";}?>">
				<?php if($band->hasImages()): ?>
				<div class="band-image">
					<img data-src="<?= $band->images()->first()->url() ?>" />
				</div>
				<?php endif ?>
				<div class="band-info">
					<h3>
						<span class="light">
							<?=$band->time() ?>
						</span>
						<?=$band->title() ?>
					</h3>
					<div class="band-stage <?= $band->stage() ?>">
						<div class="band-stage-name" data-toggle="tooltip" data-placement="right" title="<?= stagenames($band->stage()) ?>">
							<?=$band->stage() ?>
						</div>
						<div class="band-stage-close">
							<i class="fa fa-chevron-up"></i>
						</div>
					</div>
					<div class="band-genre">
						<?=$band->genre() ?></div>
					<div class="band-description">
						<?
						if (strlen($band->shortdescription())>0) {
							echo kirbytext($band->shortdescription());
						} else {
							echo kirbytext($band->description());
						} ?>
					</div>
				</div>
			</a>
		</li>
		<?php } ?>
	</ul>
</div>