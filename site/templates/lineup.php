<?php snippet( 'header') ?>
<section class="container">
	<? if (kirbytext($page->bookinginfo())) { ?>
	<div class="row bookinginfo">
		<div class="col-sm-12">
			<div class="bookinginfo-box">
				<?php echo kirbytext($page->bookinginfo()) ?>
			</div>
		</div>
	</div>
	<? } ?>
	
	<div class="row">
		<div class="col-sm-9">
			<h1>
				<?= $page->title() ?>
			</h1>
		</div>
		<div class="col-sm-3">
			
			<select class="form-control selectpicker yearSelector">
				<? $years = explode(",",$page->years()); ?>
				<? for ($i = 0; $i < count($years); $i++) { ?>
					<option value="<?=$years[$i] ?>" <? if ($i == count($years)-1) {echo 'selected="selected"';}?>><?=$years[$i] ?></option>
				<? } ?>
			</select>
		</div>
	</div>
	<div class="row">
		<div class="col-sm-12 visible-xs-block">
			<select class="form-control selectpicker stageSelector-mobile">
				<option value="" selected="selected">alle Bühnen</option>
				<option value="GB">Große Bühne</option>
				<option value="KB">Kleine Bühne</option>
				<option value="WB">Waldbühne</option>
				<option value="A" >Aula</option>
				<option value="DJ">DJ-Eck</option>
			</select>
		</div>
		<div class="col-sm-12 visible-xs-block">
			<select class="form-control selectpicker daySelector-mobile">
				<option value="" selected="selected">alle Tage</option>
				<option value="Freitag">Freitag</option>
				<option value="Samstag">Samstag</option>
				<option value="Sonntag">Sonntag</option>
			</select>
		</div>
		<div class="col-sm-12 hidden-xs">
			<div class="col-sm-2 stageSelector">
				<label class="active">
					<input type="radio" value="" name="stageSelector" checked="checked">alle&nbsp;Bühnen
				</label>
			</div>
			<div class="col-sm-2 stageSelector">
				<label class="GB">
					<input type="radio" value="GB" name="stageSelector">Große&nbsp;Bühne
				</label>
			</div>
			<div class="col-sm-2 stageSelector">
				<label class="KB">
					<input type="radio" value="KB" name="stageSelector">Kleine&nbsp;Bühne
				</label>
			</div>
			<div class="col-sm-2 stageSelector">
				<label class="WB">
					<input type="radio" value="WB" name="stageSelector">Waldbühne
				</label>
			</div>
			<div class="col-sm-2 stageSelector">
				<label class="A">
					<input type="radio" value="A" name="stageSelector">Aula
				</label>
			</div>
			<div class="col-sm-2 stageSelector">
				<label class="DJ">
					<input type="radio" value="DJ" name="stageSelector">DJ-Eck
				</label>
			</div>
		</div>
	</div>
	<div class="row">
		<? $latestYear = rsort($years); ?>		
		<?php snippet( 'lineup-row', array( 'latestYear'=>$years[0], 'tag'=>"Freitag", 'bands' => filterByStagetimes($page->children(),"Freitag"))) ?>
		<?php snippet( 'lineup-row', array( 'latestYear'=>$years[0], 'tag'=>"Samstag", 'bands' => filterByStagetimes($page->children(),"Samstag"))) ?>
		<?php snippet( 'lineup-row', array( 'latestYear'=>$years[0], 'tag'=>"Sonntag", 'bands' => filterByStagetimes($page->children(),"Sonntag"))) ?>
	</div>
	<div class="row nocontent">
		<div class="col-sm-12">
			<div class="nocontent-box">
				<i class="fa fa-ban"></i>
				<?php echo kirbytext($page->nocontent()) ?>
			</div>
		</div>
	</div>
</section>

<?php snippet( 'footer') ?>