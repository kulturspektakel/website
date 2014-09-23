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



	// fotos
	$( '.album a' ).swipebox();
	$( '.album img' ).unveil();
	$( '.album-title' ).sticky();



	// home
	$( '.news h2 a' ).click( function( e ) {
		if ( !$( this ).parents( 'li' ).find( 'article' ).is( ':visible' ) ) {
			$( '.news li article' ).slideUp( 200 );
			$( '.news li' ).removeClass( 'active' );
			$( this ).parents( 'li' ).find( 'article' ).slideDown( 200 );
			$( this ).parents( 'li' ).addClass( 'active' );
			e.preventDefault();
		}
	} );
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



	// Maps
	new GMaps( {
		div: '#maps',
		lat: 48.078509,
		lng: 11.375506,
		scrollwheel: false,
		streetViewControl: false,
		mapTypeControl: false,
		panControl: false,
		zoom: 14,
	} );
}

function applyLineupFilter(stageSelector, daySelector) {
	$( '.bandlist li' ).hide();
	if (daySelector) {
		if (daySelector.val() !== "") {
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