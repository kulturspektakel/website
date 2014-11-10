$( function() {
	if (matchMedia) {
		mq = window.matchMedia("(max-width: 768px)");
		mq.addListener(init);
	}
	init();
});

function init() {



	// all
	var isMobile = mq.matches;
	$( '#logo, .nav-logo' ).mousedown( function( event ) {
		if ( event.which == 3 ) {
			window.location.href = '/logo';
			event.preventDefault();
		}
	} );

	$( '.mobile-nav' ).click( function() {
		$( '.hero' ).toggleClass( 'active' );
	} );

	FastClick.attach( document.body );
	
	//SVG to PNG fallback
	if (!document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1")) {
		$('img[src*="svg"]').each(function(){
			$(this).attr('src', $(this).attr('src').replace('.svg', '.png'));
		});
		$('body').addClass('no-svg');
	}
	

	// lineup
	var yearSelector  = $( '.yearSelector' );
	var stageSelector = isMobile ? $( '.stageSelector-mobile' ) : $( '.stageSelector input' );
	var daySelector   = isMobile ? $( '.daySelector-mobile' )   : false;
	
	$('.selectpicker').selectpicker();
	
	yearSelector.on( 'change' , function() {
		document.location.href = yearSelector.val();
	});
	
	stageSelector.change(function () {
		$( '.stageSelector label' ).removeClass('active');
		$( this ).parent('label').addClass('active');
		applyLineupFilter(stageSelector, daySelector);
	});
	
	if (daySelector) {
		daySelector.change(function () {
			applyLineupFilter(stageSelector, daySelector);
		});
	}
	
	$( '.bandlist a' ).click( function( e ) {
		if ($(this).hasClass('no-content')) {
			return false;
		}
		if ( !$( this ).parents( 'li' ).hasClass( 'active' ) ) {
			e.preventDefault();
			$( this ).parents( 'li' ).addClass( 'active' );
		}
	} );
	$( '.bandlist .band-stage-close' ).click( function( e ) {
		$( this ).parents( '.active' ).removeClass( 'active' );
		e.preventDefault();
		e.stopPropagation();
	} );
	
	noBandsVisible();
	$( '.bandlist .band-image img' ).unveil();
	if (!isMobile) $( '.bandlist .band-stage-name' ).tooltip();
	
	$('#bandsearch').typeahead({
		minLength: 3,
		highlight: true,
	},{
		source: function (query, cb) {
			cb([]);
		}
	});


	// fotos
	$( '.album a' ).swipebox();
	$( '.album img' ).unveil();


	// home
	if (isMobile) {
		$( '.home .hero' ).sticky( {
			topSpacing: -300
		} );
	} else {
		$( '.home .hero' ).sticky( {
			topSpacing: -430
		} );
		$( document ).scroll( function() {
			$( '.home .nav-logo' ).css( 'left', Math.min( $( document ).scrollTop() - 520, 15 ) );
		} );
	}

	var styles = [{"featureType":"water","elementType":"geometry","stylers":[{"color":"#a2daf2"}]},{"featureType":"landscape.man_made","elementType":"geometry","stylers":[{"color":"#f7f1df"}]},{"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"#d0e3b4"}]},{"featureType":"landscape.natural.terrain","elementType":"geometry","stylers":[{"visibility":"off"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#bde6ab"}]},{"featureType":"poi","elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"poi.medical","elementType":"geometry","stylers":[{"color":"#fbd3da"}]},{"featureType":"poi.business","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#ffe15f"}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#efd151"}]},{"featureType":"road.arterial","elementType":"geometry.fill","stylers":[{"color":"#ffffff"}]},{"featureType":"road.local","elementType":"geometry.fill","stylers":[{"color":"black"}]},{"featureType":"transit.station.airport","elementType":"geometry.fill","stylers":[{"color":"#cfb2db"}]}];
	
	var mapOptions = {
		center: new google.maps.LatLng(48.078509, 11.375506),
		zoom:12,
		scrollwheel: false,
		mapTypeControl: false,
		zoomControl: true,
		styles: styles,
		zoomControlOptions: {
			style: google.maps.ZoomControlStyle.SMALL
		},
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	var map = new google.maps.Map(document.getElementById("maps"), mapOptions);
	var contentString = $('#maps').html();
	
	var infowindow = new google.maps.InfoWindow({
		content: contentString
	});
	var marker = new google.maps.Marker({
		position: new google.maps.LatLng(48.078509, 11.375506),
		map: map,
		title: 'Kulturspektakel Gauting'
	});
	infowindow.open(map,marker);
}

function applyLineupFilter(stageSelector, daySelector) {
	$( '.bandlist li' ).hide();
	if (daySelector) {
		if (daySelector.val() !== '') {
			$('.day-col').hide();
			$('.day-'+daySelector.val()).show();
		} else {
			$('.day-col').show();
		}
	}
	
	var stageSelectorValue = stageSelector.filter(':checked').val();
	if ( typeof stageSelectorValue === "undefined" ) {
		stageSelectorValue = stageSelector.val();
	}
	
	stageSelector = (stageSelectorValue !== "") ? '[data-stage=' + stageSelectorValue + ']' : '';
	console.log(stageSelector);
	$( '.bandlist li' + stageSelector ).show();
	noBandsVisible();
}

function noBandsVisible() {
	$('.day-col').removeClass('hidden');
	var hasBands = $('.bandlist li:visible').length <= 0;
	$('.nocontent').toggleClass('hidden',!hasBands);
	$('.day-col').toggleClass('hidden',hasBands);
}