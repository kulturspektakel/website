	</main>
	<footer class="footer" role="contentinfo">
		<div class="container">
			<div class="row">
				<div class="col-sm-6 col-sm-push-6 footer-icons">
					<div class="icons-right">
						<?=kirbytext($site->sociallinks()) ?>
					</div>
				</div>
				<div class="col-sm-6 col-sm-pull-6 footer-infos">
					<img src="/assets/img/logo.svg" class="hidden-xs" />
					<h3>Kulturspektakel Gauting e.V.</h3>
					<p>
						<?=kirbytext($site->infotext()) ?>
					</p>
					<div class="links">
						<?=kirbytext($site->footerlinks()) ?>
					</div>
				</div>
			</div>
		</div>
	</footer>
</div>
</body>

</html>