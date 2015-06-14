App = {
	init: function () {
		this.isMobile = mq.matches;
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
		
		App.map();
	},
	
	lineup: function () {
		var yearSelector   = $( '.yearSelector' );
		var stageSelector  = App.isMobile ? $( '.stageSelector-mobile' ) : $( '.stageSelector input' );
		var daySelector    = App.isMobile ? $( '.daySelector-mobile' )   : false;
		var noBandsVisible = function() {
			$('.day-col').removeClass('hidden');
			var hasBands = $('.bandlist li:visible').length <= 0;
			$('.nocontent').toggleClass('hidden',!hasBands);
			$('.day-col').toggleClass('hidden',hasBands);
		};
		var applyLineupFilter = function(stageSelector, daySelector) {
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
			$( '.bandlist li' + stageSelector ).show();
			noBandsVisible();
		}
		
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
		
		$('.bandlist li.has-content').click(function() {
			if (!$(this).hasClass('active')) {
				$(this).addClass('active');
			}
		} );
		$('.bandlist .band-stage-close').click(function() {
			setTimeout(function() {
				$(this).parents('.active').removeClass('active');
			}.bind(this), 0)			
		});
		
		noBandsVisible();
		$( '.bandlist .band-image img' ).unveil();
		if (!App.isMobile) $( '.bandlist .band-stage-name' ).tooltip();
		
		$('#bandsearch').typeahead({
			highlight: true,
		},{
			displayKey: function (o) {
				return o.name + ' (' + o.year + ')';
			},
			source: function (query, cb) {
				$.get('/search?q=' + query, function (data) {
					return cb(data);
				});
			}
		}).bind('typeahead:selected', function(obj, selected, name) {
			ga('send', 'search', selected.name);
			window.location = selected.url;
		});
		$('#q-bandsearch').click(function() {
			$('#searchcontrol').toggleClass('search-active');
			if ($('#searchcontrol').hasClass('search-active')) {
				$('.tt-input').focus();
				$('#q-bandsearch .fa').removeClass('fa-search').addClass('fa-times');
			} else {
				$('#q-bandsearch .fa').removeClass('fa-times').addClass('fa-search');
			}
		});
	},
	
	fotos: function () {
		$( '.album a' ).swipebox();
		$( '.album a[data-album]' ).click(function (e) {
			e.preventDefault();
			e.stopPropagation();
			window.location.href = $(this).attr('data-album') + '#more';
		});
		$( '.album img' ).unveil();
	},
	
	home: function () {
		if (App.isMobile) {
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
	},
	
	map: function () {
		if (!$('#maps').length) {
			
			return;
		}
		
		var styles = [{"featureType":"water","elementType":"geometry","stylers":[{"color":"#a2daf2"}]},{"featureType":"landscape.man_made","elementType":"geometry","stylers":[{"color":"#f7f1df"}]},{"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"#d0e3b4"}]},{"featureType":"landscape.natural.terrain","elementType":"geometry","stylers":[{"visibility":"off"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#bde6ab"}]},{"featureType":"poi","elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"poi.medical","elementType":"geometry","stylers":[{"color":"#fbd3da"}]},{"featureType":"poi.business","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#ffe15f"}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#efd151"}]},{"featureType":"road.arterial","elementType":"geometry.fill","stylers":[{"color":"#ffffff"}]},{"featureType":"road.local","elementType":"geometry.fill","stylers":[{"color":"black"}]},{"featureType":"transit.station.airport","elementType":"geometry.fill","stylers":[{"color":"#cfb2db"}]}];
		var mapOptions = {
			center: new google.maps.LatLng(48.078509, 11.375506),
			zoom:12,
			scrollwheel: false,
			streetViewControl: false,
			mapTypeControl: false,
			zoomControl: true,
			styles: styles,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		var map = new google.maps.Map(document.getElementById("maps"), mapOptions);
		var contentString = $('#maps').html();
		
		var marker = new google.maps.Marker({
			position: new google.maps.LatLng(48.078509, 11.375506),
			map: map,
			title: 'Kulturspektakel Gauting'
		});
	},

	shop: function () {
		$('.shop select').change(function () {
			$('.shop #shop-total').text((getTotal()+0.001).toFixed(2).replace('.',','));
			validate();
		});

		$('.shop input').keyup(function () {
			validate();
		});

		$('.shop form').submit(function () {
			if (validate()) {
				$('.shop .btn-success').prop('disabled',true);
				var data = {};
				$('.shop select').each(function () {
					data[$(this).attr('id')] = $(this).val();
				});
				$('.shop input').each(function () {
					data[$(this).attr('id')] = $(this).val();
				});
				$.post('/shop/order',data,function () {
					$('.products').hide();
					$('.shop-success').show();
				});
			}
			return false;
		});

		var validate = function () {
			var valid = true;
			$('.shop input[required]').each(function () {
				if ($(this).val().length === 0) valid = false;
			});
			if (getTotal() === 0) valid = false;

			$('.shop .btn-success').prop('disabled',!valid);
			return valid;
		};

		var getTotal = function () {
			var total = 0;
			$('.shop select').each(function () {
				var amount = parseInt($(this).val());
				if (isNaN(amount)) amount = 1;
				var price = parseFloat($(this).attr('data-price'));
				if (isNaN(price)) price = 0;
				total += price*amount;
			});
			return total;
		};

	}
};


$( function() {
	if (matchMedia) {
		mq = window.matchMedia("(max-width: 768px)");
		mq.addListener(App.init);
	}
	App.init();
	$.each($.trim($('body').attr('class')).split(/\s+/), function(i,c){
		if (App[c]) App[c]();
	});
});