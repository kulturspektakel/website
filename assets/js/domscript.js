$(function(){
	
	// all
	$('#logo').mousedown(function(event) {
		if (event.which == 3) {
			window.location.href = "/logo";
			event.preventDefault();
		}
	});
	
	
	// lineup
	if (window.location.hash.length>1) $('.selectpicker').val(window.location.hash.substring(1));
	$('.selectpicker').selectpicker();
	$('.selectpicker').on('change', function() {
		location.hash = $('.selectpicker').val()
		$('.bandlist li').hide();
		$('.bandlist [data-year='+$('.selectpicker').val()+']').show().removeClass('hidden');
	});
	$('.selectpicker').change();
	
	$('.bandlist a').click(function (e) {
		if (!$(this).parents("li").hasClass("active")) {
			e.preventDefault();
			$(this).parents("li").addClass("active");
		}
	});	
	$(".bandlist .band-stage-close").click(function (e) {
		$(this).parents(".active").removeClass("active");
		e.preventDefault();
		e.stopPropagation();
	});
	
	$('.bandlist .band-image img').unveil();
	$('.bandlist .band-stage-name').tooltip();

	
	// fotos
	$('.album a').fancybox({
		padding : 0
	});
	$('.album img').unveil();
	
	
	// home
	$('.news h2 a').click(function (e){
		if (!$(this).parents('li').find('article').is(':visible')) {
			$('.news li article').slideUp(200);
			$('.news li').removeClass('active');
			$(this).parents('li').find('article').slideDown(200);
			$(this).parents('li').addClass('active');
			e.preventDefault();
		}
	});
	
	
	// Maps
	new GMaps({
	  div: '#maps',
	  lat: 48.078509,
	  lng: 11.375506,
	  scrollwheel: false,
	  streetViewControl: false,
	  mapTypeControl: false,
	  panControl: false,
	  zoom: 14,
	});
	
	
	
	
});
