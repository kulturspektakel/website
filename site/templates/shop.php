<?php snippet('header') ?>

<section class="container">
	<?php echo kirbytext($page->text()) ?>
</section>

<section class="container products">
	<form>
		<div class="row">
			<?php $i = 0; ?>
			<?php foreach ($page->children() as $product) { ?>
				<div class="col-sm-4">
					<h2>
						<?php echo $product->title() ?>
						<span class="pricetag">
							<?php echo str_replace(",00","",number_format(doubleval($product->price().""),2,",","")) ?>&nbsp;&euro;
						</span>
					</h2>
					<?php if ($product->hasImages()) { ?>
						<img class="productimage" src="<?php echo thumb($product->images()->first(), array('width' => 716, 'height' => 716, 'crop' => true))->url() ?>" />
					<?php } ?>
					<select id="<?php echo $product->slug() ?>" class="form-control" data-price="<?php echo $product->price() ?>">
						<?php if ($product->selector()=="size") { ?>
							<option value="0" selected>Größe auswählen</option>
							<option>Größe S</option>
							<option>Größe M</option>
							<option>Größe L</option>
							<option>Größe XL</option>
							<option>Größe XXL</option>
						<?php } else { ?>
							<option value="0" selected>Menge auswählen</option>
							<option>1</option>
							<option>2</option>
							<option>3</option>
							<option>4</option>
						<?php } ?>
					</select>
					<?php echo kirbytext($product->description()) ?>
				</div>
				<?php if ($i==2) { ?>
					</div><div class="row">
				<?php } $i++; ?>
			<?php } ?>
		</div>

		<div class="col-sm-offset-3 col-sm-6 orderform">
			<div class="form-horizontal">
				<div class="form-group">
					<label for="shop-name" class="col-sm-4 control-label">Name</label>
					<div class="col-sm-8">
						<input type="text" class="form-control" id="shop-name" required>
					</div>
				</div>
				<div class="form-group">
					<label for="shop-mail" class="col-sm-4 control-label">E-Mail</label>
					<div class="col-sm-8">
						<input type="email" class="form-control" id="shop-mail" required>
					</div>
				</div>
				<div class="form-group">
					<label for="shop-phone" class="col-sm-4 control-label">Handy&shy;nummer</label>
					<div class="col-sm-8">
						<input type="tel" class="form-control" id="shop-phone" required>
					</div>
				</div>
				<div class="form-group">
					<label for="shop-phone" class="col-sm-4 control-label">Summe</label>
					<div class="col-sm-8 total">
						<span id="shop-total">0,00</span>&nbsp;&euro;
					</div>
				</div>
				<div class="form-group">
					<div class="col-sm-offset-4 col-sm-8">
						<button type="submit" class="btn btn-success" disabled>Bestellen</button>
					</div>
				</div>
			</div>
		</div>
	</form>
</section>

<section class="container shop-success">
	<div class="form-group">
		<div class="col-sm-offset-3 col-sm-6">
			<span class="icon">✌️</span>
			<?php echo kirbytext($page->success()) ?>
		</div>
	</div>
</section>

<?php snippet('footer') ?>
