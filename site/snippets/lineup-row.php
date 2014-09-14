<div class="col-sm-4 day-col day-<?=$tag ?>">
	<h2>
		<?=$tag ?>
	</h2>
	<ul class="bandlist">
		<? foreach(listBands($bands,$tag) as $band) { ?>
		<li class="<? if ($band->stagetime->year!=$latestYear) echo " hidden "; ?>" data-stage="<?= $band->stagetime->stage ?>" data-year="<?= $band->stagetime->year ?>" data-time="<?= preg_replace("/[^0-9]/", "",$band->stagetime->time) ?>">
			<a href="<?= $band->url() ?>">
				<?php if($band->hasImages()): ?>
				<div class="band-image">
					<img data-src="<?= $band->images()->first()->url() ?>" />
				</div>
				<?php endif ?>
				<div class="band-info">
					<h3>
						<span class="light">
							<?=$band->stagetime->time ?>
						</span>
						<?=$band->title() ?>
					</h3>
					<div class="band-stage <?= $band->stagetime->stage ?>">
						<div class="band-stage-name" data-toggle="tooltip" data-placement="right" title="<?= stagenames($band->stagetime->stage) ?>">
							<?=$band->stagetime->stage ?>
						</div>
						<div class="band-stage-close">
							<i class="fa fa-chevron-up"></i>
						</div>
					</div>
					<div class="band-genre">
						<?=$band->genre() ?></div>
					<div class="band-description">
						<?=kirbytext($band->description()) ?>
					</div>
				</div>
			</a>
		</li>
		<? } ?>
	</ul>
</div>