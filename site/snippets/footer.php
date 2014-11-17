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

<script>
	(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	})(window,document,'script','//www.google-analytics.com/analytics.js','ga');
	
	ga('create', 'UA-1451591-11', 'auto');
	ga('send', 'pageview');
</script>
</body>
</html>